/* global Pebble, XMLHttpRequest */

var MAX_TEMPS = 240;
var FMI_WFS_BASE = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0' +
  '&request=getFeature' +
  '&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::timevaluepair' +
  '&parameters=Temperature,Precipitation1h,WindSpeedMS,WindDirection,HourlyMaximumGust,TotalCloudCover&timestep=60';

var pendingFetch = false;

Pebble.addEventListener('ready', function () {
  console.log('PebbleKit JS ready');
  fetchForecast();
});

Pebble.addEventListener('appmessage', function (e) {
  if (e.payload.REQUEST_DATA !== undefined) {
    fetchForecast();
  }
});

function fetchForecast() {
  if (pendingFetch) return;
  pendingFetch = true;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        fetchForLatLon(pos.coords.latitude, pos.coords.longitude, null);
      },
      function () {
        fetchForLatLon(60.1699, 24.9384, 'Helsinki');
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  } else {
    fetchForLatLon(60.1699, 24.9384, 'Helsinki');
  }
}

function fetchForLatLon(lat, lon, fallbackName) {
  var now = new Date();
  var startTime = new Date(now);
  startTime.setMinutes(0, 0, 0);

  var endTime = new Date(startTime.getTime() + MAX_TEMPS * 60 * 60 * 1000);

  var url = FMI_WFS_BASE +
    '&latlon=' + lat.toFixed(4) + ',' + lon.toFixed(4) +
    '&starttime=' + toIsoString(startTime) +
    '&endtime=' + toIsoString(endTime);

  console.log('Fetching FMI: ' + url);

  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    pendingFetch = false;
    if (xhr.status === 200) {
      parseAndSend(xhr.responseText, startTime, fallbackName);
    } else {
      console.log('HTTP error: ' + xhr.status);
      sendStatus(2);
    }
  };
  xhr.onerror = function () {
    pendingFetch = false;
    console.log('XHR error');
    sendStatus(2);
  };
  xhr.open('GET', url);
  xhr.send();
}

function extractSeries(xml, paramName) {
  var blockRe = new RegExp(
    '<wml2:MeasurementTimeseries[^>]*' + paramName + '[\\s\\S]*?</wml2:MeasurementTimeseries>');
  var blockMatch = xml.match(blockRe);
  if (!blockMatch) return [];
  var values = [];
  var valueRe = /<wml2:value>([-\d.NaN]+)<\/wml2:value>/g;
  var match;
  while ((match = valueRe.exec(blockMatch[0])) !== null) {
    values.push(parseFloat(match[1]));
  }
  return values;
}

function parseAndSend(xml, startTime, fallbackName) {
  var tempRaw   = extractSeries(xml, 'Temperature');
  var precipRaw = extractSeries(xml, 'Precipitation1h');
  var wspdRaw   = extractSeries(xml, 'WindSpeedMS');
  var wdirRaw   = extractSeries(xml, 'WindDirection');
  var wgustRaw  = extractSeries(xml, 'HourlyMaximumGust');
  var cloudRaw  = extractSeries(xml, 'TotalCloudCover');

  // Truncate temperatures at first NaN
  var temperatures = [];
  for (var i = 0; i < tempRaw.length; i++) {
    if (isNaN(tempRaw[i])) break;
    temperatures.push(Math.round(tempRaw[i]));
  }

  // Limit to MAX_TEMPS
  if (temperatures.length > MAX_TEMPS) {
    temperatures = temperatures.slice(0, MAX_TEMPS);
  }

  if (temperatures.length === 0) {
    console.log('No temperature values parsed');
    sendStatus(2);
    return;
  }

  // Precipitation: 0 for NaN, same length as temperatures, tenths of mm as uint8
  var precipByteArray = [];
  for (var i = 0; i < temperatures.length; i++) {
    var p = (i < precipRaw.length && !isNaN(precipRaw[i])) ? precipRaw[i] : 0;
    precipByteArray.push(Math.min(255, Math.ceil(Math.max(0, p) * 10)));
  }

  // Wind speed: whole m/s as uint8, 255=NaN
  var wspdByteArray = [];
  for (var i = 0; i < temperatures.length; i++) {
    var s = (i < wspdRaw.length && !isNaN(wspdRaw[i])) ? wspdRaw[i] : NaN;
    wspdByteArray.push(isNaN(s) ? 255 : Math.min(254, Math.round(s)));
  }

  // Wind direction: 0-360 mapped to 0-254, 255=NaN
  var wdirByteArray = [];
  for (var i = 0; i < temperatures.length; i++) {
    var d = (i < wdirRaw.length && !isNaN(wdirRaw[i])) ? wdirRaw[i] : NaN;
    wdirByteArray.push(isNaN(d) ? 255 : Math.min(254, Math.round(d / 360 * 254)));
  }

  // Wind gust: whole m/s as uint8, 255=NaN
  var wgustByteArray = [];
  for (var i = 0; i < temperatures.length; i++) {
    var g = (i < wgustRaw.length && !isNaN(wgustRaw[i])) ? wgustRaw[i] : NaN;
    wgustByteArray.push(isNaN(g) ? 255 : Math.min(254, Math.round(g)));
  }

  // Cloud cover: 0-100% as uint8, 255=NaN
  var cloudByteArray = [];
  for (var i = 0; i < temperatures.length; i++) {
    var c = (i < cloudRaw.length && !isNaN(cloudRaw[i])) ? cloudRaw[i] : NaN;
    cloudByteArray.push(isNaN(c) ? 255 : Math.min(100, Math.round(c)));
  }

  // Extract location name
  var locMatch = xml.match(
    /<gml:name codeSpace="http:\/\/xml\.fmi\.fi\/namespace\/locationcode\/name">([^<]+)<\/gml:name>/
  );
  var locationName = (locMatch ? locMatch[1].trim() : null) || fallbackName || 'Unknown';

  // Encode temperatures as plain Array of unsigned bytes (int8 two's-complement)
  var byteArray = [];
  for (var i = 0; i < temperatures.length; i++) {
    var t = Math.max(-128, Math.min(127, temperatures[i]));
    byteArray.push(t < 0 ? t + 256 : t);
  }

  // Local hour of day for the first data point (phone local time)
  var localStartHour = startTime.getHours();

  // Which array index corresponds to "now"
  var nowMs = Date.now();
  var currentIndex = Math.round((nowMs - startTime.getTime()) / 3600000);
  currentIndex = Math.max(0, Math.min(currentIndex, temperatures.length - 1));

  var nonZeroPrecip = precipByteArray.filter(function(v) { return v > 0; }).length;
  var nonNaNWind = wspdByteArray.filter(function(v) { return v !== 255; }).length;
  var nonNaNCloud = cloudByteArray.filter(function(v) { return v !== 255; }).length;
  var nonNaNGust = wgustByteArray.filter(function(v) { return v !== 255; }).length;
  console.log('Sending ' + temperatures.length + ' temps, ' + nonZeroPrecip + ' precip buckets, ' +
    nonNaNWind + ' wind values, ' + nonNaNGust + ' gust values, ' + nonNaNCloud + ' cloud values, current index=' + currentIndex + ', location=' + locationName);

  Pebble.sendAppMessage(
    {
      STATUS: 1,
      TEMPERATURES: byteArray,
      PRECIPITATION: precipByteArray,
      WIND_SPEED: wspdByteArray,
      WIND_DIRECTION: wdirByteArray,
      WIND_GUST: wgustByteArray,
      CLOUD_COVER: cloudByteArray,
      LOCAL_START_HOUR: localStartHour,
      LOCAL_START_WEEKDAY: startTime.getDay(),
      LOCAL_START_DAY: startTime.getDate(),
      LOCAL_START_MONTH: startTime.getMonth() + 1,
      CURRENT_INDEX: currentIndex,
      LOCATION_NAME: locationName.substring(0, 32)
    },
    function () { console.log('Data sent OK'); },
    function (err) {
      console.log('Send error: ' + JSON.stringify(err));
      Pebble.sendAppMessage({
        STATUS: 1,
        TEMPERATURES: byteArray,
        PRECIPITATION: precipByteArray,
        LOCAL_START_HOUR: localStartHour,
        CURRENT_INDEX: currentIndex,
        LOCATION_NAME: 'FMI'
      });
    }
  );
}

function sendStatus(status) {
  Pebble.sendAppMessage({ STATUS: status });
}

function toIsoString(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
