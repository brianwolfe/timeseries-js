

/**
 * This is a module that subsamples data samples for particular windows to
 * make graphing at various scales easier. By returning sub-sampled data when
 * long time windows are requested and the full data when fewer than N (~= 1000)
 * sample points are requested, this provides an easy encapsulation of a large
 * array of data that can be graphed at many zoom levels.
 */
var TimeSeries = TimeSeries || {};

/**
 * This encapsulates reading a raw binary string and returning the ArrayBuffer
 * version of the data.
 */
TimeSeries.toTypedArray = function(buffer, dataType, littleEndian) {
  'use strict';
  if (typeof(dataType) == 'undefined') {
    dataType = 'uint32_t';
  }

  if (typeof(littleEndian) === 'undefined') {
    littleEndian = true;
  }

  var typemap = {
    // C types
    'int8_t': {type: Int8Array, conversion: DataView.prototype.getInt8},
    'uint8_t': {type: Uint8Array, conversion: DataView.prototype.getUint8},
    'int16_t': {type: Int16Array, conversion: DataView.prototype.getInt16},
    'uint16_t': {type: Uint16Array, conversion: DataView.prototype.getUint16},
    'int32_t': {type: Int32Array, conversion: DataView.prototype.getInt32},
    'uint32_t': {type: Int16Array, conversion: DataView.prototype.getUint32},
    'float': {type: Float32Array, conversion: DataView.prototype.getFloat32},
    'double': {type: Float64Array, conversion: DataView.prototype.getFloat64},
    // Numpy datatypes
    'int8': {type: Int8Array, conversion: DataView.prototype.getInt8},
    'uint8': {type: Uint8Array, conversion: DataView.prototype.getUint8},
    'int16': {type: Int16Array, conversion: DataView.prototype.getInt16},
    'uint16': {type: Uint16Array, conversion: DataView.prototype.getUint16},
    'int32': {type: Int32Array, conversion: DataView.prototype.getInt32},
    'uint32': {type: Uint32Array, conversion: DataView.prototype.getUint32},
    'float32': {type: Float32Array, conversion: DataView.prototype.getFloat32},
    'float64': {type: Float64Array, conversion: DataView.prototype.getFloat64}
  };

  var dv = new DataView(buffer);

  var offset;
  var curtype = typemap[dataType].type;
  var conversion = typemap[dataType].conversion;
  var inc = curtype.BYTES_PER_ELEMENT;
  var n_elements = dv.byteLength / inc;
  var typedArray = new curtype(n_elements);

  for (offset = 0; offset < n_elements; offset ++) {
    typedArray[offset] = conversion.call(dv, offset * inc, littleEndian)
  }

  return typedArray;
}

/**
 * Given a raw time buffer, data buffer, and a type for the data,
 * construct a timeseries object that can be used to extract meaningful
 * data at particular points in time and over particular windows in time.
 *
 * \param time  A typed array containing the time values to index the data with
 * \param data  A typed array containing the data values associated with each timepoint
 * 
 * Restriction: data.length % time.length == 0. The width of the data
 *              (number of samples per timestamp should be constant, ensuring this).
 *              If data.length % time.length != 0 the series alignment may be
 *              corrupted.
 */
TimeSeries.BasicSeries = function(time, data, dtype) {
  'use strict';
  this.time = time;
  this.data = data;
  this.width = Math.floor(data.length / time.length);

  if (data.length % time.length != 0) {
    console.log("Invalid data provided, the data length must equal the time length");
  }
}

/**
 * given a target element el and a sorted array arr, search for el in arr,
 * returning the index of el if it exists. If el is less than any element in
 * arr, return 0, otherwise, return the index of the element in arr that
 * would precede el if el were inserted.
 */
TimeSeries.binarySearch = function(el, arr) {
  'use strict';
  var min_index = 0;
  var max_index = arr.length;
  var diff;
  var cur_index;
  var cur_el;

  while (min_index <= max_index) {
    cur_index = Math.floor((max_index - min_index) / 2) + min_index;
    cur_el = arr[cur_index];

    if (cur_el < el) {
      min_index = cur_index + 1;
    } else if (cur_el > el) {
      max_index = cur_index - 1;
    } else {
      return cur_index;
    }
  }

  return max_index;
}

/**
 * Return the data (this.width samples) for the last sample with timestamp
 * at most t.
 *
 * This returns a typed array with the same type as the raw data.
 */
TimeSeries.BasicSeries.prototype.asof = function(t) {
  'use strict';
  var ind = TimeSeries.binarySearch(t, this.time);
  var s_ind = ind * this.width;
  return this.data.subarray(s_ind, s_ind + this.width);
}

/**
 * \param  lowtime     lower time to include, one sample beyond this time can be included
 * \param  hightime    higher time to include, one sample beyond this time can be included
 * \param  maxpoints   maximum number of points (default 1000)
 * return: a subsampled window of timestamps as a normal array with each
 *  element in the array being an associative array with the following
 *  entries:
 *  {
 *    time: average time of sample
 *    mean: [array of means, one for each subsample]
 *    max: [array of maximums, one for each subsample]
 *    min: [array of minimums, one for each subsample]
 *    std: [array of standard deviations, one for each subsample]
 *    num: number of samples
 *  }
 *
 */
TimeSeries.BasicSeries.prototype.getValues = function(lowtime, hightime, maxpoints) {
  'use strict';

  if (typeof(lowtime) == 'undefined') {
    lowtime = this.time[0];
  }
  if (typeof(hightime) == 'undefined') {
    hightime = this.time[this.time.length - 1];
  }
  if (typeof(maxpoints) == 'undefined') {
    maxpoints = 1000;
  }
  var start_ind = TimeSeries.binarySearch(lowtime, this.time);
  var end_ind = TimeSeries.binarySearch(hightime, this.time);

  if (end_ind < this.time.length - 1) {
    end_ind ++;
  }

  var start_time = this.time[start_ind];
  var end_time = this.time[end_ind];

  var interval = (end_time - start_time) / maxpoints;

  var cur_time = start_time,
      mean_time = 0,
      mean = new Float64Array(this.width),
      squared_mean = new Float64Array(this.width),
      max = this.data.subarray(start_ind * this.width, (start_ind + 1) * this.width),
      min = this.data.subarray(start_ind * this.width, (start_ind + 1) * this.width),
      num = 0,
      res = [];

  for (var i = start_ind; i <= end_ind; i++) {
    if (cur_time + interval < this.time[i]) {
      var std = new Float64Array(this.width);
      for (var j = 0; j < this.width; j++) {
        mean[j] /= num;
        squared_mean[j] /= num;
        std[j] = Math.sqrt(squared_mean[j] - mean[j] * mean[j]);
      }
      res.push({
        time: mean_time / num,
        mean: mean,
        std: std,
        min: min,
        max: max,
        num: num
      });
      mean_time = 0;
      mean = new Float64Array(this.width);
      squared_mean = new Float64Array(this.width);
      max = this.data.subarray(i * this.width, (i + 1) * this.width);
      min = this.data.subarray(i * this.width, (i + 1) * this.width);
      num = 0;
      // Mark the start of the next interval. Taking the max of these two moves
      // the sample point forward to the next timepoint if the interval is less than
      // the typical timepoint.
      cur_time = Math.max(cur_time + interval, this.time[i + 1] - interval * 0.99);
    }

    mean_time += this.time[i];
    num ++;
    for (var j = 0; j < this.width; j++) {
      var cur_sample = this.data[i * this.width + j];
      mean[j] += cur_sample;
      squared_mean[j] += cur_sample * cur_sample;
      max[j] = Math.max(max[j], cur_sample);
      min[j] = Math.min(min[j], cur_sample);
    }
  }

  // Append the final sample if necessary.
  if (num > 0) {
    std = new Float64Array(this.width);
    for (var j = 0; j < this.width; j++) {
      mean[j] /= num;
      squared_mean[j] /= num;
      std[j] = Math.sqrt(squared_mean[j] - mean[j] * mean[j]);
    }
    res.push({
      time: mean_time / num,
      mean: mean,
      std: std,
      min: min,
      max: max,
      num: num
    });
  }

  return res;
}
