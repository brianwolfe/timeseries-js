

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
  typemap = {
    // C types
    'int8_t': {type: Int8Array, conversion: DataView.prototype.getInt8};
    'uint8_t': {type: Uint8Array, conversion: DataView.prototype.getUint8};
    'int16_t': {type: Int16Array, conversion: DataView.prototype.getInt16};
    'uint16_t': {type: Uint16Array, conversion: DataView.prototype.getUint16};
    'int32_t': {type: Int32Array, conversion: DataView.prototype.getInt32};
    'uint32_t': {type: Int16Array, conversion: DataView.prototype.getUint32};
    'float': {type: Float32Array, conversion: DataView.prototype.getFloat32};
    'double': {type: Float64Array, conversion: DataView.prototype.getFloat64};
    // Numpy datatypes
    'int8': {type: Int8Array, conversion: DataView.prototype.getInt8};
    'uint8': {type: Uint8Array, conversion: DataView.prototype.getUint8};
    'int16': {type: Int16Array, conversion: DataView.prototype.getInt16};
    'uint16': {type: Uint16Array, conversion: DataView.prototype.getUint16};
    'int32': {type: Int32Array, conversion: DataView.prototype.getInt32};
    'uint32': {type: Uint32Array, conversion: DataView.prototype.getUint32};
    'float': {type: Float32Array, conversion: DataView.prototype.getFloat32};
    'double': {type: Float64Array, conversion: DataView.prototype.getFloat64};
  };

  if (typeof(dataType) == 'undefined') {
    dataType = 'uint32_t';
  }

  var bigEndian = true;

  if (littleEndian) {
    bigEndian = false;
  }

  var dv = DataView(data);

  var offset;
  var curtype = typemap[dataType].type;
  var conversion = typemap[dataType].conversion;
  var inc = curtype.BYTES_PER_ELEMENT;
  var n_elements = dv.byteLength / inc;
  var typedArray = new curtype(n_elements);

  for (offset = 0; offset < n_elements; offset ++) {
    typedArray[offset] = conversion.prototype.call(dv, offset * inc)
  }

  return typedArray;
}

/**
 * Given a raw time buffer, data buffer, and a type for the data,
 * construct a timeseries object that contains the 
 */
TimeSeries.SubsampleSeries = function(time, data, dtype) {
  var time_dv = new TimeSeries.DataArray(time, 'uint32');
  var data_dv = new DataView(data);

  if (typeof(dtype) == 'undefined') {
  }
}


