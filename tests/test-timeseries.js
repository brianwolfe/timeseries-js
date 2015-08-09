function make_random_array_uint32(len) {
  var i;
  var a = new Uint32Array(len);
  for (i = 0; i < len; i++) {
    a[i] = Math.random() * 32767 * 32767;
  }
  return a;
}

function make_random_array_int32(len) {
  var i;
  var a = new Int32Array(len);
  for (i = 0; i < len; i++) {
    a[i] = Math.random() * 32767 * 32767;
  }
  return a;
}

function make_random_array_float32(len) {
  var i;
  var a = new Float32Array(len);
  for (i = 0; i < len; i++) {
    a[i] = (Math.random() - 0.5) * 1000;
  }
  return a;
}

function check_equal(a1, a2) {
  expect(a1.length).toBe(a2.length);

  var total_diff = 0;
  for (var i = 0; i < a1.length; i ++) {
    total_diff += Math.abs(a1[i] - a2[i]);
  }

  expect(total_diff).toBe(0);
}

describe("Typed array conversion tests", function () {
  it("Convert uint32 typed array", function() {
    var len = 500;
    test_data = make_random_array_int32(len);
    data = TimeSeries.toTypedArray(test_data.buffer, 'int32_t', true);
    check_equal(data, test_data);
  });

  it("Convert float32 typed array", function() {
    var len = 5;
    test_data = make_random_array_float32(len);
    data = TimeSeries.toTypedArray(test_data.buffer, 'float32', true);
    check_equal(data, test_data);
  });

  it("Convert to twice to reverse byte orders", function () {
    var len = 100;
    test_data = make_random_array_uint32(len);

    data_tmp = TimeSeries.toTypedArray(test_data.buffer, 'uint32', false);
    data_bigendian = TimeSeries.toTypedArray(data_tmp.buffer, 'uint32', false);

    data_tmp = TimeSeries.toTypedArray(test_data.buffer, 'uint32', true);
    data_littleendian = TimeSeries.toTypedArray(data_tmp.buffer, 'uint32', true);

    check_equal(data_bigendian, test_data);
    check_equal(data_littleendian, test_data);
  });
});

function make_time_data(interval, n_samples) {
  var i;
  var a = new Uint32Array(n_samples);
  for (i = 0; i < n_samples; i++) {
    a[i] = i * interval;
  }
  return a;
}

describe("Test SubsampleSeries", function() {
  it("Check time alignment of series", function() {
    // Construct a basic time series with 1 column with 3 subcolumns, sampled
    // every 20 ms.
    var time_data = make_time_data(20, 100);
    var values = make_random_array_uint32(300);
    var series = new TimeSeries.BasicSeries(time_data, values, 'uint32');

    var sample = series.asof(80);
    var offset = 4;

    for (var i = 0; i < 3; i++)
    {
      expect(sample[i]).toBe(values[3 * offset + i]);
    }
  });

  it("Check basic sanity of getting a data window", function() {
    var time_data = make_time_data(10, 1000);
    var values = make_random_array_uint32(3000);
    var series = new TimeSeries.BasicSeries(time_data, values, 'uint32');

    var samples = series.getValues(0, 1000, 10);

    expect(samples[0].num, 5);
    expect(samples[1].num, 5);
    expect(samples[0].time, 40);
    expect(samples[0].mean[0],
        (values[0] + values[3] + values[6] + values[9] + values[12]) / 5);

    var variance = 0;
    var max = values[0];
    var min = values[0];
    for (var i = 0; i < 5; i++) {
      variance += Math.pow(values[i * 3] - samples[0].mean[0], 2);
      max = Math.max(max, values[i * 3]);
      min = Math.min(min, values[i * 3]);
    }

    variance /= 5;

    var std = Math.sqrt(variance);

    expect(samples[0].std[0], std);

    expect(samples[0].max, max);
    expect(samples[0].min, min);
  });
});
