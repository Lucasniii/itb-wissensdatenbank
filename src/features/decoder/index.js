var ZC_DEFS = {
  2:  'Replace value in [engine_temp] with value from 1-Wire temperature sensor',
  3:  'Replace value in [engine_speed] with value calculated from impulse input',
  4:  'Enable CAN units unification',
  5:  'Use output 1 for Dallas immobilizer function',
  7:  'Convert value in [total_distance] to miles',
  8:  'Enable checking of applied Dallas chip against list stored in terminal memory',
  10: 'Enable support for 3D sensor',
  12: 'Enable maintaining values in [total_distance], [total_fuel] and [fuel_level]',
  16: 'Dedicated customer feature',
  17: 'Dedicated customer feature',
  18: 'Impulse input mode (0 = count impulses from engine, 1 = count from flow meter)',
  20: 'Enable generation of DRVID frame on tachograph status change or driver card insertion/removal',
  22: 'Replace value in [total_fuel] with value calculated from impulse input',
  23: 'Enable reading vehicle speed from tachograph data',
  27: 'Dedicated customer feature',
  28: 'Enable activating output for Dallas immobilizer immediately after ignition off',
  29: 'Replace values in [VoltageAnalog1] and [VoltageAnalog2] with voltages from input 1+ and 2+'
};

var ZC2_DEFS = {
  1:  'Enable support for internal CAN module with internal TMR module (not applicable since Feb 2019)',
  2:  'Insert total vehicle weight into [axleweight4] field',
  3:  'Enable support for reading data from Himoinsa CEM7 power generator',
  5:  'Insert value from impulse input into [range] field',
  6:  'Insert 1-Wire thermometer temperature into [wiretemp6] instead of Jamming/CREG/CME/CMS value',
  7:  'Enable support for external expander module',
  9:  'Dedicated customer feature',
  10: 'Dedicated customer feature',
  13: 'Dedicated customer feature',
  16: 'Enable support for Bluetooth module',
  17: 'Always refresh data from CAN module',
  18: 'Change voltage threshold for input state (state 0 below 2V, state 1 above 2V)',
  19: 'Activate CAN bus data for FM15 CAN terminal',
  20: 'Do not refresh GPS location when [drivercode] field is empty',
  21: 'Use output 2 for Dallas immobilizer function',
  22: 'Use output 3 for Dallas immobilizer function',
  23: 'Enable sending commands through RS232TTL port using UARTDATA command',
  25: 'Dedicated customer feature',
  26: 'Send data frames through RS232TTL port (default baud rate 9600, changeable via ZVALUE:30)',
  29: 'Dedicated customer feature',
  30: 'Insert maximum registered [engine_speed] value between data frames',
  31: 'Enable SENT-GEO function',
  32: 'Dedicated customer feature'
};

var ZC3_DEFS = {
  2:  'Insert maximum registered [vehicle_speed] value between data frames',
  5:  'Enable RFID Rotation Direction Detector support',
  7:  'Dedicated customer feature',
  8:  'Dedicated customer feature',
  10: 'ELA Innovations sensors support and fuel inlet protection ZWP-Q80 support (requires ZCONFIG2:16)',
  12: 'Enable POWERTEMP module support for 1-Wire thermometer',
  13: 'Enable chronological event transmission during sleep mode operation',
  14: 'Treat family code 0x09 as a 1-Wire thermometer',
  15: 'Dedicated customer feature',
  16: 'Dedicated customer feature',
  17: 'Enable POWERTEMP module logic for 1-Wire thermometer without physical module (PCB S8_v31, S10_v3+)',
  18: 'Read RFID card or Dallas button code only once after ignition changes from 0 to 1',
  19: 'Enable POWERTEMP module support for BTLE module',
  20: 'Enable POWERTEMP module logic for BTLE without physical module (PCB S8_v31, S10_v3+)',
  21: 'Dedicated customer feature',
  22: 'Dedicated customer feature',
  23: 'Enable locking for [total_distance] and [total_fuel] – values lower than last registered will not be visible',
  24: 'Enable EXPANDER PRO MODULE support',
  25: 'Turn off Bluetooth module after ignition changes from 1 to 0',
  26: 'Dedicated customer feature',
  27: 'Dedicated customer feature',
  28: 'Dedicated customer feature',
  29: 'Enable temperature and humidity sensor DTH22 support (GPR000059)',
  30: 'Enable CIPIA-FS10 support',
  31: 'Dedicated customer feature',
  32: 'Convert [Engine_hours], [Engine_idle_time], [Drive_time_over_rpmlimit], [Drive_time_over_speedlimit], [Total_driving_time_with_accelerator_kick_down], [Total_driving_time_when_cruise_control_is_on] from minutes to seconds'
};

var ZC4_DEFS = {
  1:  'Do not insert PTO state from CAN bus into [inputs2] field and do not generate event 127 frames',
  2:  'Retrieve ignition signal for TMR module from violet wire/ignition/virtualacc instead of D8',
  3:  'Enable Victron Energy BMV-700 battery monitor support',
  4:  'Charge internal battery continuously regardless of ignition state',
  5:  'TEX MID400 support (driver installed on a tanker)',
  6:  'Active scanning mode by BLE module',
  7:  'Substitute "battery instantaneous voltage" into [voltageanalog4] and "battery temperature" into [range]',
  8:  'Dedicated customer feature',
  9:  'Turn off internal TMR module',
  10: 'Add cruise-control-off condition for calculating value in [coasting] field',
  11: 'Dedicated customer feature',
  12: 'Read total fuel consumption value from frame 0x79',
  13: 'Dedicated customer feature',
  14: 'Dedicated customer feature'
};

var ZV_DEFS = {
  1:  'Multiplier for [total_fuel]',
  3:  'Fuel tank capacity (for % ↔ litre conversion)',
  8:  'Max [engine_speed] for SETECO function',
  9:  'Multiplier for [total_distance]',
  10: 'Max [accelerator] for [rapid_pedal_pressure] counter',
  11: 'Max [vehicle_speed] for [drive_time_over_speedlimit] counter',
  12: 'Max [engine_speed] for [drive_time_over_rpmlimit] counter',
  13: 'Number of samples for filtering analog probe voltage',
  14: 'Sampling time for filtering analog probe voltage',
  15: 'Divider for pulse input',
  20: 'Multiplier for [vehicle_speed]',
  21: 'Limit speed – above: driving start event; below: driving end event',
  22: 'Max accelerator pedal pressure – beyond this, event frame #98 is generated',
  23: 'Time output remains active after ignition on (Dallas immobilizer)',
  24: 'Dedicated customer feature',
  25: 'Delay for stopping pulse count from pulse input (requires ZCONFIG:18 = 1)',
  26: 'Time after which Dallas immobilizer auth expires after ignition off',
  27: 'Time after which Bluetooth sensor disappears from data frame when out of range',
  28: 'Dedicated customer feature',
  29: 'Dedicated customer feature',
  30: 'Baud rate setting (0 = 9600)',
  31: 'Delay for SENT-GEO function'
};

var ZV2_DEFS = {
  1:  'Time after which output 2 turns on – no GPS / no GSM / no TCP connection',
  2:  'Time after which output 2 turns off – no GPS / no GSM / no TCP connection',
  3:  'Select input to stop refreshing GPS position (Bit1=Input1+, Bit2=Input2+, Bit4=Input1-, Bit5=Input2-)',
  4:  'Block indicators from [indicators_c] field – bits 0–31 per Indicators C description',
  5:  'Delay to enter POWERMODE',
  6:  'Limit for counting engine torque above set limit (stored in reserved field of F16/F17 frames)',
  7:  'Frequency for generating events in case of towing (TOW command)',
  8:  'Select inputs with state 0 after power reset (Bit0=Ignition+, Bit1=Input1+, Bit2=Input2+, Bit4=Input1-, Bit5=Input2-)',
  9:  'Select inputs not refreshed when ignition turns off (Bit1=Input1+, Bit2=Input2+, Bit4=Input1-, Bit5=Input2-)',
  10: 'Reserved',
  11: 'Reserved',
  12: 'BLEVOLTAGE frame sending frequency (BLE Eddystone UID/TLM)',
  13: 'Choose inputs to start ImmoDallas (ZCONFIG:5) – (Bit1=Input1+, Bit2=Input2+, Bit4=Input1-, Bit5=Input2-)',
  14: 'GPS module working mode (Bit0=GPS, Bit1=GLONASS, Bit2=GALILEO, Bit3=GALILEO FULL, Bit4=BEIDOU) – 0 = GPS+GLONASS default',
  15: 'Described in ETOLL documentation',
  16: 'Battery level for electric cars in Wh (e.g. 55000 = 55 kWh) – enables kWh counting in [total_fuel]',
  17: 'Set bit 3 in [inputs2] to 1 when engine speed exceeds this value',
  18: 'Dedicated customer feature',
  19: 'Subtract defined value from [vehicle_speed]',
  20: 'Delay to enter SLEEPMODE',
  21: 'Do not count [total_idle_fuel] / [engine_idle_time] when PTO engaged (1=CAN, 2=JP1-5, 3=JP2-8, 5=JP1-4, 6=JP2-1)',
  22: 'Lower RPM threshold for counting [total_driving_time_in_effective_range]',
  23: 'Dedicated customer feature'
};

var DATACONFIG_DEFS = [
  {n:1,name:'Longitude'}, {n:2,name:'Latitude'}, {n:3,name:'Heading'}, {n:4,name:'Satellite'},
  {n:5,name:'GSM_signal'}, {n:6,name:'Altitude'}, {n:7,name:'GSM_operator'}, {n:8,name:'Inputs'},
  {n:9,name:'Inputs2'}, {n:10,name:'Outputs'}, {n:11,name:'VoltageAnalog1'}, {n:12,name:'VoltageAnalog2'},
  {n:13,name:'VoltageAnalog3'}, {n:14,name:'VoltageAnalog4'}, {n:15,name:'VoltageAnalog6'}, {n:16,name:'SpeedGPS'},
  {n:17,name:'Vehicle_speed'}, {n:18,name:'MileageGPS'}, {n:19,name:'Total_distance'}, {n:20,name:'Total_fuel'},
  {n:21,name:'Total_idle_fuel'}, {n:22,name:'Fuel_level_percents'}, {n:23,name:'Fuel_level_litres'}, {n:24,name:'Fuel_Flag'},
  {n:25,name:'Fuel_consump'}, {n:26,name:'Accelerator'}, {n:27,name:'Engine_speed'}, {n:28,name:'Engine_temperature'},
  {n:29,name:'Engine_hours'}, {n:30,name:'Engine_idle_time'}, {n:31,name:'Oil_temperature'}, {n:32,name:'Hydraulic_oil_temperature'},
  {n:33,name:'Tachograph'}, {n:34,name:'Axleweight1'}, {n:35,name:'Axleweight2'}, {n:36,name:'Axleweight3'},
  {n:37,name:'Axleweight4'}, {n:38,name:'Axleweight5'}, {n:39,name:'axle_brutto'}, {n:40,name:'Indicators_C'},
  {n:41,name:'1WireTemp_1'}, {n:41,name:'WireCode_1'}, {n:41,name:'1WireTemp_2'}, {n:41,name:'WireCode_2'},
  {n:41,name:'1WireTemp_3'}, {n:41,name:'WireCode_3'}, {n:41,name:'1WireTemp_4'}, {n:41,name:'Wire Code_4'},
  {n:41,name:'1WireTemp_5'}, {n:41,name:'WireCode_5'}, {n:41,name:'1WireTemp_6'}, {n:41,name:'WireCode_6'},
  {n:42,name:'Rapid_pedal_pressure'}, {n:43,name:'Rapid_accelerations'}, {n:44,name:'Rapid_brakings'}, {n:45,name:'Engine_speed_overspeed_counter'},
  {n:46,name:'RANGE'}, {n:47,name:'Drive_time_over_rpmlimit'}, {n:48,name:'Drive_time_over_speedlimit'}, {n:49,name:'Driver1_IDcard_tacho'},
  {n:50,name:'Driver2_IDcard_tacho'}, {n:51,name:'DriverCode'}, {n:52,name:'3DX'}, {n:52,name:'3DY'},
  {n:52,name:'3DZ'}, {n:53,name:'ecospeed_1'}, {n:53,name:'ecospeed_2'}, {n:53,name:'ecospeed_3'},
  {n:53,name:'ecospeed_4'}, {n:53,name:'ecospeed_5'}, {n:53,name:'ecospeed_6'}, {n:53,name:'ecoRPM_1'},
  {n:53,name:'ecoRPM_2'}, {n:53,name:'ecoRPM_3'}, {n:53,name:'ecoRPM_4'}, {n:53,name:'ecoRPM_5'},
  {n:53,name:'ecoRPM_6'}, {n:53,name:'eco_acc_1'}, {n:53,name:'eco_acc_2'}, {n:53,name:'eco_acc_3'},
  {n:53,name:'eco_acc_4'}, {n:53,name:'eco_acc_5'}, {n:53,name:'eco_acc_6'}, {n:53,name:'eco_braking_1'},
  {n:53,name:'eco_braking_2'}, {n:53,name:'eco_braking_3'}, {n:53,name:'eco_braking_4'}, {n:53,name:'eco_braking_5'},
  {n:53,name:'eco_braking_6'}, {n:53,name:'eco_pedalpress_1'}, {n:53,name:'eco_pedalpress_2'}, {n:53,name:'eco_pedalpress_3'},
  {n:53,name:'eco_pedalpress_4'}, {n:53,name:'eco_pedalpress_5'}, {n:53,name:'eco_pedalpress_6'}, {n:53,name:'Total_number_of_brakeapplies'},
  {n:53,name:'Pedal_braking_factor'}, {n:53,name:'Engine_braking_factor'}, {n:53,name:'Total_number_of_accelerator_kick_downs'}, {n:53,name:'Total_driving_time_with_accelerator_kick_down'},
  {n:53,name:'Total_driving_time_when_cruise_control_is_on'}, {n:54,name:'Dedicated customer feature'}, {n:55,name:'adblue'}, {n:56,name:'engine_oil_level'},
  {n:57,name:'alternative_gasoline'}, {n:58,name:'engine_torque'}, {n:59,name:'distance_to_service'}, {n:60,name:'coasting'},
  {n:61,name:'pto_duration'}, {n:62,name:'pto_fuel_consumption'}, {n:63,name:'clutch_presses'}, {n:64,name:'retarder_usage'},
  {n:65,name:'R2'}, {n:65,name:'R3'}, {n:65,name:'R4'}, {n:65,name:'R5'},
  {n:65,name:'R6'}, {n:66,name:'R7'}, {n:67,name:'beacon1'}, {n:67,name:'beacon2'},
  {n:68,name:'Dedicated customer feature'}, {n:69,name:'vin_trailer'}, {n:70,name:'battery_temperature'}, {n:71,name:'total_driving_time_in_effective_range'},
  {n:72,name:'total_engine_cold_running_time'}, {n:73,name:'engine_load'}, {n:74,name:'gearbox'}, {n:75,name:'power_mode'},
  {n:76,name:'trailer_gross_weight'}, {n:77,name:'dpf_soot_level'}, {n:78,name:'passenger_seats_and_seatbelts'}, {n:79,name:'driving_time'},
  {n:80,name:'turbo_pressure'}, {n:81,name:'ambient_temperature'}, {n:82,name:'brake_pedal_pressure'}, {n:83,name:'engine_all_starts_count'},
  {n:84,name:'engine_cold_starts_count'}, {n:85,name:'engine_starts_by_ignition_count'}, {n:86,name:'handbrake_applies_on_the_ride'}, {n:87,name:'battery_instantaneous_voltage'},
  {n:88,name:'electric_car\'s_battery_instantaneous_current'}, {n:89,name:'electric_car\'s_battery_instantaneous_power'}, {n:90,name:'electric_car\'s_battery_charging_current'}, {n:91,name:'total_electric_engine_running_time'},
  {n:92,name:'electric_car\'s_battery_charging_status'}, {n:93,name:'remaining_charge_time'}, {n:94,name:'electric_car\'s_total_energy_recuperated'}, {n:95,name:'electric_car\'s_total_energy_used_while_driving'},
  {n:96,name:'electric_car\'s_total_energy_charged'}, {n:97,name:'electric_car\'s_total_effective_energy_used'}, {n:98,name:'electric_car\'s_battery_state_of_health'}, {n:99,name:'electric_car\'s_battery_charging_cycles_count'},
];

var zcBits = [];
var zcMode = 'config'; // 'config' | 'value' | 'value2'
var zcCurFilter = 'all';
var zcDcView = 'full'; // 'full' | 'grid' (nur DATACONFIG)

function zcParse() {
  var raw = document.getElementById('zc-input').value.trim();
  var out = document.getElementById('zc-out');

  if (!raw) {
    out.innerHTML = '<div class="zc-empty">Paste a $QR:ZCONFIG, $QR:ZCONFIG2, $QR:ZCONFIG3, $QR:ZCONFIG4, $QR:ZVALUE, $QR:ZVALUE2, $QR:DATACONFIG or $QR:CHECKTMR string above and press Decode.</div>';
    document.getElementById('zc-filter-row').style.display = 'none';
    document.getElementById('zc-dcview-row').style.display = 'none';
    document.getElementById('zc-search-row').style.display = 'none';
    return;
  }

  var isCheckTmr = /CHECKTMR/i.test(raw);
  if (isCheckTmr) {
    zcMode = 'checktmr';
    document.getElementById('zc-filter-row').style.display = 'none';
    document.getElementById('zc-dcview-row').style.display = 'none';
    document.getElementById('zc-search-row').style.display = 'none';
    out.innerHTML = zcParseCheckTmr(raw);
    return;
  }

  var isDataConfig = /DATACONFIG/i.test(raw);
  var isValue2  = !isDataConfig && /ZVALUE2/i.test(raw);
  var isValue   = !isDataConfig && !isValue2 && /ZVALUE/i.test(raw);
  var isConfig4 = !isDataConfig && /ZCONFIG4/i.test(raw);
  var isConfig3 = !isDataConfig && !isConfig4 && /ZCONFIG3/i.test(raw);
  var isConfig2 = !isDataConfig && !isConfig4 && !isConfig3 && /ZCONFIG2/i.test(raw);
  zcMode = isDataConfig ? 'dataconfig' : (isValue2 ? 'value2' : (isValue ? 'value' : (isConfig4 ? 'config4' : (isConfig3 ? 'config3' : (isConfig2 ? 'config2' : 'config')))));

  if (zcMode === 'dataconfig') {
    var dm = raw.match(/DATACONFIG\s*=\s*(?:[0-9A-F]+\s*,\s*)?([01\s]+)/i);
    var dseq = dm ? dm[1] : raw;
    zcBits = dseq.replace(/\s+/g, '').split('').map(function(c) { return parseInt(c, 10); }).filter(function(b) { return !isNaN(b); });
  } else {
    var m = raw.match(/Z(?:VALUE2|VALUE|CONFIG4|CONFIG3|CONFIG2|CONFIG)\s*=\s*([\d,\s]+)/i);
    var seq = m ? m[1] : raw;
    zcBits = seq.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(b) { return !isNaN(b); });
  }

  if (!zcBits.length) {
    out.innerHTML = '<div class="zc-error">No valid string found. Expected: $QR:ZCONFIG=\u2026 / $QR:ZVALUE=\u2026 / $QR:DATACONFIG=\u2026 / $QR:CHECKTMR=\u2026</div>';
    document.getElementById('zc-filter-row').style.display = 'none';
    document.getElementById('zc-dcview-row').style.display = 'none';
    document.getElementById('zc-search-row').style.display = 'none';
    return;
  }

  if (zcMode === 'value' || zcMode === 'value2') {
    document.getElementById('zc-f-on-label').textContent  = 'Non-zero only';
    document.getElementById('zc-f-off-label').textContent = 'Zero only';
  } else if (zcMode === 'dataconfig') {
    document.getElementById('zc-f-on-label').textContent  = 'Vorhanden';
    document.getElementById('zc-f-off-label').textContent = 'Nicht vorhanden';
  } else {
    document.getElementById('zc-f-on-label').textContent  = 'Active only';
    document.getElementById('zc-f-off-label').textContent = 'Inactive only';
  }

  // DATACONFIG-Umschalter und Suche nur bei DATACONFIG zeigen
  if (zcMode === 'dataconfig') {
    document.getElementById('zc-dcview-row').style.display = 'flex';
    zcDcView = 'full';
    document.getElementById('zc-dc-full').classList.add('active');
    document.getElementById('zc-dc-grid').classList.remove('active');
  } else {
    document.getElementById('zc-dcview-row').style.display = 'none';
  }

  document.getElementById('zc-filter-row').style.display = 'flex';
  document.getElementById('zc-search-row').style.display = 'flex';
  document.getElementById('zc-search').value = '';
  zcCurFilter = 'all';
  ['all','on','off'].forEach(function(x) {
    document.getElementById('zc-f-' + x).classList.toggle('active', x === 'all');
  });
  zcRender();
}

function zcSetDcView(v) {
  zcDcView = v;
  document.getElementById('zc-dc-full').classList.toggle('active', v === 'full');
  document.getElementById('zc-dc-grid').classList.toggle('active', v === 'grid');
  zcRender();
}

function zcSearchTerm() {
  var el = document.getElementById('zc-search');
  return el ? el.value.trim().toLowerCase() : '';
}

function zcClearSearch() {
  var el = document.getElementById('zc-search');
  if (el) el.value = '';
  zcRender();
}

function zcToggleBit(n) {
  if (zcMode !== 'dataconfig') return;
  var idx = n - 1;
  if (idx < 0 || idx >= zcBits.length) return;
  zcBits[idx] = (zcBits[idx] === 1) ? 0 : 1;
  var ta = document.getElementById('zc-input');
  var bitStr = zcBits.join('');
  ta.value = '$AL+DATACONFIG=0000,' + bitStr;
  zcRender();
}

function zcFilter(f) {
  zcCurFilter = f;
  ['all','on','off'].forEach(function(x) {
    document.getElementById('zc-f-' + x).classList.toggle('active', x === f);
  });
  zcRender();
}

function zcRender() {
  if (zcMode === 'dataconfig') { zcRenderDataConfig(); return; }
  var defs = zcMode === 'value2' ? ZV2_DEFS : (zcMode === 'value' ? ZV_DEFS : (zcMode === 'config4' ? ZC4_DEFS : (zcMode === 'config3' ? ZC3_DEFS : (zcMode === 'config2' ? ZC2_DEFS : ZC_DEFS))));
  var featureType = zcTypeForMode();
  var q = zcSearchTerm();
  var html = '<div class="zc-grid">';
  var shown = 0;

  for (var i = 0; i < zcBits.length; i++) {
    var num = i + 1;
    var val = zcBits[i];
    var isOn = (zcMode === 'value' || zcMode === 'value2') ? (val !== 0) : (val === 1);

    if (zcCurFilter === 'on'  && !isOn) continue;
    if (zcCurFilter === 'off' &&  isOn) continue;

    var desc = defs[num];
    var descriptionHtml = zcFeatureDescription(featureType, num, desc || '<span class="zc-no-def">Not defined</span>');

    if (q) {
      var hay = (String(num) + ' ' + (desc || '') + ' ' + zcFeatureSearchText(featureType, num)).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    shown++;

    if (zcMode === 'value' || zcMode === 'value2') {
      var pillCls  = isOn ? 'on' : 'off';
      var pillText = val.toString();
      html += '<div class="zc-bit' + (isOn ? ' is-on' : '') + '">' +
        '<span class="zc-bit-num' + (isOn ? ' on' : '') + '">' + num + '</span>' +
        '<span class="zc-pill ' + pillCls + '" style="min-width:52px;text-align:center">' + pillText + '</span>' +
        '<span class="zc-desc' + (isOn ? ' on' : '') + '">' +
          descriptionHtml +
        '</span>' +
      '</div>';
    } else {
      html += '<div class="zc-bit' + (isOn ? ' is-on' : '') + '">' +
        '<span class="zc-bit-num' + (isOn ? ' on' : '') + '">' + num + '</span>' +
        '<span class="zc-pill ' + (isOn ? 'on' : 'off') + '">' + (isOn ? '1 \u2013 ON' : '0 \u2013 OFF') + '</span>' +
        '<span class="zc-desc' + (isOn ? ' on' : '') + '">' +
          descriptionHtml +
        '</span>' +
      '</div>';
    }
  }

  html += '</div>';
  if (!shown) html = '<div class="zc-empty">No entries match the current filter.</div>';
  document.getElementById('zc-out').innerHTML = html;
}

/* ── CHECKTMR Decoder ──
   Farbige Ergebnisliste (gruen = ok, rot = Problem). Ohne Kollisionsframe-Zweitfeld. */
function zcParseCheckTmr(input) {
  var G = function(t) { return '<span style="color:var(--green);font-weight:700">' + t + '</span>'; };
  var R = function(t) { return '<span style="color:var(--red);font-weight:700">' + t + '</span>'; };

  var parts = input.split('=');
  if (parts.length !== 2) {
    return '<div class="zc-error">Error: Invalid QR data format! Erwartet: $QR:CHECKTMR=\u2026</div>';
  }
  var p = parts[1].trim().toUpperCase().replace(/\s+/g, '');

  var firstTachover  = parseInt(p.substring(0, 1), 16);
  var secondTachover = parseInt(p.substring(1, 2), 16);
  var thirdTachover  = parseInt(p.substring(2, 4), 16);
  var fourthTachover = parseInt(p.substring(4, 6), 16);

  var hardwareVersion = p.substring(6, 8).substring(0, 1) + '.' + p.substring(6, 8).substring(1, 2);
  var serialNumber = parseInt((p.substring(14, 16) + p.substring(12, 14) + p.substring(10, 12) + p.substring(8, 10)), 16);

  var INF  = parseInt(p.substring(18, 20), 16).toString(2).padStart(8, '0');
  var INF2 = parseInt(p.substring(20, 22), 16).toString(2).padStart(8, '0');

  var canBusActivity = '';
  var ab = INF.substring(6, 8);
  if (ab === '00') canBusActivity = R('CAN-Bus im Sleep-Modus (inaktiv)');
  else if (ab === '01') canBusActivity = G('CAN-Bus aktiv');
  else if (ab === '10') canBusActivity = R('CAN-Bus Fehler (ungueltige Verbindung)');
  else if (ab === '11') canBusActivity = R('CAN-Bus nicht verwendet');

  var canBusLabel = (firstTachover === 2) ? 'CAN-Bus Aktivitaet: ' : 'CAN-Bus Aktivitaet (orange): ';

  var carIgnition = '';
  var ig = INF.substring(4, 6);
  if (ig === '00') carIgnition = R('Zuendung aus');
  else if (ig === '01') carIgnition = G('Zuendung ein');
  else if (ig === '11') carIgnition = G('Information nicht verfuegbar');
  else if (ig === '10') carIgnition = R('Fehler am CAN-Bus');

  var engineStatus = '';
  var en = INF.substring(2, 4);
  if (en === '00') engineStatus = G('Motor aus');
  else if (en === '01') engineStatus = G('Motor ein');
  else if (en === '11') engineStatus = G('Information nicht verfuegbar');
  else if (en === '10') engineStatus = R('Fehler am CAN-Bus');

  var isB3 = (p.substring(24, 26) === 'B3');

  var remoteDownload = '';
  var rd = INF.substring(0, 2);
  if (isB3) {
    if (rd === '00') remoteDownload = R('CAN-Bus im Sleep-Modus');
    else if (rd === '01') remoteDownload = G('CAN-Bus aktiv');
    else if (rd === '11') remoteDownload = R('CAN-Bus nicht verwendet');
    else if (rd === '10') remoteDownload = R('CAN-Bus Fehler');
  } else {
    if (rd === '00') remoteDownload = R('Funktion aus');
    else if (rd === '01') remoteDownload = G('Funktion ein');
    else if (rd === '11') remoteDownload = R('noch nicht bestimmt');
    else if (rd === '10') remoteDownload = R('unbekannte Antwort');
  }

  var d8BusActivity = '';
  var d8 = INF2.substring(6, 8);
  if (d8 === '00') d8BusActivity = R('D8-Bus Sleep-Modus (inaktiv)');
  else if (d8 === '01') d8BusActivity = G('D8-Bus aktiv');
  else if (d8 === '10') d8BusActivity = R('Kommunikationsfehler oder getrennt');
  else if (d8 === '11') d8BusActivity = R('Information noch nicht verfuegbar');

  var tachoOnline = '';
  var to = INF2.substring(4, 6);
  if (to === '00') tachoOnline = R('keine Kommunikation mit Tachograph');
  else if (to === '01') tachoOnline = G('Tachograph online');
  else if (to === '10') tachoOnline = R('Fehler');
  else if (to === '11') tachoOnline = R('Information nicht verfuegbar (Sleep/Fehler)');
  else tachoOnline = R('unbekannte Antwort');

  var testStatus = '';
  if (isB3) {
    var ts = INF2.substring(2, 4);
    if (ts === '00') testStatus = R('Funktion aus');
    else if (ts === '01') testStatus = G('Funktion ein');
    else if (ts === '10') testStatus = R('Kommunikationsfehler');
    else if (ts === '11') testStatus = R('Tachograph-Kommunikation mit aktueller Konfiguration nicht unterstuetzt');
  } else {
    var ts4 = INF2.substring(0, 4);
    if (ts4 === '0000') testStatus = G('kein Test (Abwaertskompatibilitaet)');
    else if (ts4 === '0001') testStatus = G('OK. Nachrichten werden auf dem CAN-Bus empfangen');
    else if (ts4 === '0010') testStatus = G('OK. Selbsttest des CAN-Bus erfolgreich');
    else if (ts4 === '0100') testStatus = R('Fehler, CAN-Bus im rezessiven Zustand');
    else if (ts4 === '0101') testStatus = R('Fehler, CAN-Bus im dominanten Zustand');
    else testStatus = R('unbekannte Antwort');
  }

  var tp = p.substring(22, 24);
  var tachographProducer = '';
  if (tp === '00') tachographProducer = 'unbekannt';
  else if (tp === '01') tachographProducer = 'VDO/Siemens/Continental';
  else if (tp === '02') tachographProducer = 'Efas';
  else if (tp === '03') tachographProducer = 'Stoneridge';
  else if (tp === '04') tachographProducer = 'Actia';
  else if (tp === '80') tachographProducer = 'Verbindungsfehler am D8-Draht';
  else if (tp === '81') tachographProducer = 'Format „2400" Analog-Tachograph nicht unterstuetzt (nur RTC)';
  else tachographProducer = 'unbekannte Antwort';

  var modelHex = isB3 ? p.substring(26) : p.substring(24);
  var model = '';
  for (var i = 0; i + 1 < modelHex.length; i += 2) {
    var code = parseInt(modelHex.substr(i, 2), 16);
    if (code === 0) continue;
    if (!isNaN(code)) model += String.fromCharCode(code);
  }
  model = model.replace(/\0+$/, '').trim();

  var rows = [];
  rows.push('Firmware-Version: ' + firstTachover + '.' + secondTachover + '.' + thirdTachover + '.' + fourthTachover);
  rows.push('Hardware-Version: ' + hardwareVersion);
  rows.push('Seriennummer: ' + serialNumber);
  rows.push('Tachograph-Hersteller: ' + tachographProducer);
  rows.push('Tachograph-Modell: ' + (model || '\u2014'));
  rows.push('<br>' + canBusLabel + canBusActivity);
  rows.push('Zuendung: ' + carIgnition);
  rows.push('Motorstatus: ' + engineStatus);
  if (isB3) {
    rows.push('CAN-Bus 2 Aktivitaet (gruen): ' + remoteDownload);
    rows.push('Remote Download: ' + testStatus);
  } else {
    rows.push('Remote Download: ' + remoteDownload);
  }
  rows.push('D8-Bus Aktivitaet: ' + d8BusActivity);
  rows.push('Tachograph online auf CAN-Bus: ' + tachoOnline);

  return '<div class="zc-ctmr">' + rows.join('<br>') + '</div>';
}

function zcEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}

function zcRenderDataConfig() {
  if (zcDcView === 'grid') { zcRenderDataGrid(); return; }
  // Feldliste: eine Bit-Position (DataN) kann mehrere Feldnamen haben ->
  // jeder Feldname als eigene Zeile. Bit=1 vorhanden (gruen), Bit=0 nicht.
  var html = '<div class="zc-grid zc-grid-cols">';
  var shown = 0;
  var q = zcSearchTerm();

  for (var i = 0; i < DATACONFIG_DEFS.length; i++) {
    var def = DATACONFIG_DEFS[i];
    var bit = zcBits[def.n - 1];
    var isOn = (bit === 1);
    var known = (typeof bit !== 'undefined');

    if (zcCurFilter === 'on'  && !isOn) continue;
    if (zcCurFilter === 'off' &&  isOn) continue;

    if (q) {
      var hay = ('data' + def.n + ' ' + def.n + ' ' + def.name + ' ' + zcFeatureSearchText('DATACONFIG', def.n)).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    shown++;

    var pillCls  = isOn ? 'on' : 'off';
    var pillText = isOn ? 'vorhanden' : 'nicht vorh.';

    html += '<div class="zc-bit zc-clickable' + (isOn ? ' is-on' : '') + '"' +
      (known ? ' onclick="zcToggleBit(' + def.n + ')" title="Klicken zum Umschalten"' : '') + '>' +
      '<span class="zc-bit-num' + (isOn ? ' on' : '') + '" style="min-width:48px;white-space:nowrap">Data' + def.n + '</span>' +
      '<span class="zc-pill ' + pillCls + '" style="min-width:78px;text-align:center">' + pillText + '</span>' +
      '<span class="zc-desc' + (isOn ? ' on' : '') + '" style="color:var(--text)">[' + zcEsc(def.name) + ']' +
        (known ? '' : ' <span class="zc-no-def">(kein Bit)</span>') +
        zcFeatureDescription('DATACONFIG', def.n, '') +
      '</span>' +
    '</div>';
  }

  html += '</div>';
  if (!shown) html = '<div class="zc-empty">No entries match the current filter.</div>';
  document.getElementById('zc-out').innerHTML = html;
}

function zcRenderDataGrid() {
  // Kompaktes Raster: nur Data1..DataN als Kaestchen. gruen=vorhanden, grau=nicht.
  var html = '<div class="zc-dgrid">';
  var shown = 0;
  var q = zcSearchTerm();

  var nameByN = {};
  if (q) {
    for (var di = 0; di < DATACONFIG_DEFS.length; di++) {
      var d = DATACONFIG_DEFS[di];
      nameByN[d.n] = (nameByN[d.n] || '') + ' ' + d.name;
    }
  }

  for (var n = 1; n <= zcBits.length; n++) {
    var isOn = (zcBits[n - 1] === 1);

    if (zcCurFilter === 'on'  && !isOn) continue;
    if (zcCurFilter === 'off' &&  isOn) continue;

    if (q) {
      var hay = ('data' + n + ' ' + n + ' ' + (nameByN[n] || '') + ' ' + zcFeatureSearchText('DATACONFIG', n)).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    shown++;

    html += '<div class="zc-dcell zc-clickable ' + (isOn ? 'on' : 'off') + '" onclick="zcToggleBit(' + n + ')" title="Data' + n + ': ' + (isOn ? 'vorhanden' : 'nicht vorhanden') + ' – klicken zum Umschalten">' +
      '<span class="dn">' + n + '</span>' +
    '</div>';
  }

  html += '</div>';
  if (!shown) html = '<div class="zc-empty">No entries match the current filter.</div>';
  document.getElementById('zc-out').innerHTML = html;
}

/* ════════════════════════════════════════════════════════════════
   VIEW 3 – PTO-ERKENNUNG
   ════════════════════════════════════════════════════════════════ */
