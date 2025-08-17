
class DiarizationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channel = input[0];

    if (channel) {
      // The hook expects a Uint8Array, so we convert the Float32Array from the worklet.
      const uint8Data = new Uint8Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        // Convert from [-1, 1] range to [0, 255]
        uint8Data[i] = (channel[i] * 128) + 128;
      }
      // Post the raw audio data back to the main thread for feature analysis.
      this.port.postMessage(uint8Data);
    }

    // Return true to keep the processor alive.
    return true;
  }
}

registerProcessor('diarization-processor', DiarizationProcessor);
