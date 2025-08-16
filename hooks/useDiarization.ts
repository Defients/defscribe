
import { useState, useEffect, useRef, useCallback } from 'react';
import { type DiarizationSettings, type DiarizationSegment, type SpeakerId } from '../types';

const CHUNK_SIZE = 4096;

const workletProcessorScript = `
// This script is loaded as an AudioWorkletProcessor.
// It receives 128-sample frames from the browser's audio engine
// and buffers them into larger chunks of ${CHUNK_SIZE} samples for analysis.
class DiarizationAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = ${CHUNK_SIZE};
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    // We expect a single input with a single channel.
    const input = inputs[0];
    const channelData = input[0];

    // If there's no input data (e.g., microphone muted), keep processor alive but do nothing.
    if (!channelData) {
      return true;
    }

    // Append new audio data to our internal buffer.
    const remainingSpace = this.bufferSize - this.bufferIndex;
    const toCopy = Math.min(channelData.length, remainingSpace);
    this.buffer.set(channelData.subarray(0, toCopy), this.bufferIndex);
    this.bufferIndex += toCopy;

    // When the buffer is full, send it to the main thread for processing.
    if (this.bufferIndex >= this.bufferSize) {
      // Post a copy of the buffer. The browser's structured clone algorithm handles this.
      this.port.postMessage(this.buffer);
      
      // Reset the buffer and carry over any extra samples from the current input chunk.
      const leftover = channelData.length - toCopy;
      if (leftover > 0) {
        this.buffer.set(channelData.subarray(toCopy));
        this.bufferIndex = leftover;
      } else {
        this.bufferIndex = 0;
      }
    }
    
    // Return true to indicate that the processor should not be terminated.
    return true;
  }
}

registerProcessor('diarization-audio-processor', DiarizationAudioProcessor);
`;

const workerScript = `
// Meyda.js v5.6.2 embedded to prevent network errors
/*! Meyda - v5.6.2 - 2023-08-10 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):(e="undefined"!=typeof globalThis?globalThis:e||self,t(e.Meyda={}))}(this,function(e){"use strict";var t={chroma:!0,spectralSpread:!0,spectralCentroid:!0,spectralRolloff:!0,spectralFlatness:!0,spectralSlope:!0,spectralKurtosis:!0,spectralSkewness:!0,loudness:!0,perceptualSharpness:!0,perceptualSpread:!0,power:!0,rms:!0,zcr:!0,energy:!0,mfcc:!0,buffer:!0},r={S:0,C:1,Db:2,"C#":2,D:3,Eb:4,"D#":4,E:5,F:6,Gb:7,"F#":7,G:8,Ab:9,"G#":9,A:10,Bb:11,"A#":11,B:12},i=440,a={44100:31.7,48e3:34.4,96e3:68.8,192e3:137.6},n={hanning:function(e,t){for(var r=0;r<e;r++)t[r]=.5*(1-Math.cos(2*Math.PI*r/(e-1)))},hamming:function(e,t){for(var r=0;r<e;r++)t[r]=.54-.46*Math.cos(2*Math.PI*r/(e-1))},blackman:function(e,t){for(var r=0;r<e;r++)t[r]=.42-.5*Math.cos(2*Math.PI*r/(e-1))+.08*Math.cos(4*Math.PI*r/(e-1))},sine:function(e,t){for(var r=Math.PI/(e-1),i=0;i<e;i++)t[i]=Math.sin(r*i)}};function s(e){var t={};for(var r in e)t[r]=e[r];return t}var o,l,u=new((o=function(){function e(){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),function(e,t,r){t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r}(this,"complex",void 0),function(e,t,r){t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r}(this,"mag",void 0),function(e,t,r){t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r}(this,"phase",void 0)}return function(e,t,r){t&&c(e.prototype,t),r&&c(e,r)}(e,[{key:"magnitude",get:function(){return this.mag||(this.mag=this.complex.map(function(e){return Math.sqrt(e[0]*e[0]+e[1]*e[1])})),this.mag}},{key:"phase",get:function(){return this.phase||(this.phase=this.complex.map(function(e){return Math.atan2(e[1],e[0])})),this.phase}}]),e}())).prototype.calculate=function(e,t){for(var r=e,i=t,a=this.BitReverseComplexArray(r),n=2;n<=r;n<<=1)for(var s=0;s<n/2;s++){for(var o=s*i*2*Math.PI/n,l=Math.cos(o),u=Math.sin(o),h=s;h<r;h+=n){var c=a[h],f=a[h+n/2][0]*l-a[h+n/2][1]*u,p=a[h+n/2][0]*u+a[h+n/2][1]*l;a[h+n/2]=[c[0]-f,c[1]-p],a[h]=[c[0]+f,c[1]+p]}}this.complex=a},u.prototype.BitReverseComplexArray=function(e){for(var t=[],r=0;r<e.length;r++)t[r]=[e[r],0];for(var i=0;i<e.length;i++){for(var a=i,n=0,s=Math.floor(Math.log2(e.length))-1;s>=0;s--)n+=(a&1)<<s,a>>=1;n>i&&(t[n]=t.splice(i,1,t[n])[0])}return t},u.prototype.transform=function(){return this.complex},u.prototype.inverseTransform=function(){return this.calculate(this.complex,1),this.complex.map(function(e){return[e[0]/this.complex.length,e[1]/this.complex.length]})},u.prototype.getSpectrum=function(){return this.magnitude},u.prototype.getPhase=function(){return this.phase};var h={},c=function(e,t){for(var r=0;r<t.length;r++){var i=t[r];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}},f={bufferSize:512,hopSize:void 0,sampleRate:44100,startImmediately:!0,channel:0,windowingFunction:"hanning",featureExtractors:[],callback:null,audioContext:null,source:null,meydaWorkletOptions:null,inputs:1,outputs:1},p={};var d,g,m,v,y=new((g=function(e){function t(){var e;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),function(e,t,r){t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r}(this,"signal",void 0),e=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,function(e,t){return(t=w(t))?Object.create(t):{}}(d,e).prototype),function(e,t,r){t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r}(this,"_m",s(f)),e||this}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&w(e,t)}(t,e),d=t,m=[{key:"EXTRACTION_STARTED",get:function(){return"meyda-extraction-started"}},{key:"START",get:function(){return"start"}},{key:"STOP",get:function(){return"stop"}},{key:"MEYDA_WORKLET_PROCESSOR_NAME",get:function(){return"meyda-worklet-processor"}}],(v=null)&&c(d.prototype,v),m&&c(d,m),t}(u))).prototype.createMeydaWorklet=function(e,t){var r=this;return this._m.audioContext.audioWorklet.addModule(e,this._m.meydaWorkletOptions).then(function(){r._m.workletNode=new AudioWorkletNode(r._m.audioContext,t,r._m.meydaWorkletOptions),r._m.workletNode.port.onmessage=function(e){"MEYDA_FEATURES"===e.data.type&&r._m.callback(e.data.features)},r._m.source.connect(r._m.workletNode),r._m.workletNode.connect(r._m.audioContext.destination)})},y.prototype.start=function(e){var r=this;this._m.featureExtractors=e||this._m.featureExtractors;var i=this._m.audioContext,a=i.createScriptProcessor(this._m.bufferSize,this._m.inputs,this._m.outputs);a.onaudioprocess=function(e){r.signal=e.inputBuffer.getChannelData(r._m.channel),r.process(),r._m.callback(r.get(r._m.featureExtractors))},this._m.source.connect(a),a.connect(i.destination),this._m.spn=a},y.prototype.stop=function(){this._m.spn.disconnect(this._m.audioContext.destination),this._m.spn.onaudioprocess=null,this._m.spn=null},y.prototype.setSource=function(e){this._m.source=e},y.prototype.setAudioContext=function(e){this._m.audioContext=e},y.prototype.get=function(e){var r=this;if(e)if(Array.isArray(e)){var i={};return e.forEach(function(e){i[e]=r.get(e)}),i}if(t[e]&&"function"==typeof p[e])return p[e](this);throw new Error("Invalid Feature "+e);var a={};return Object.keys(t).forEach(function(e){a[e]=r.get(e)}),a},y.prototype.process=function(){var e=this.signal,t=this._m.bufferSize,r=this._m.windowingFunction;if(e&&e.length){var i,a;if(e.length==t)i=e;else{i=new Float32Array(t);for(var s=0;s<e.length;s++)i[s]=e[s];for(s=e.length;s<i.length;s++)i[s]=0}a="undefined"!=typeof n[r]?n[r](t,i):i,this.signal=a,this.calculate(this.signal,-1),this.complex=this.transform()}else throw new Error("Signal should be a non-empty array.")};var w=function(e,t){return(w=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])})(e,t)};p.buffer=function(e){return e.signal},p.rms=function(e){for(var t=0,r=0;r<e.signal.length;r++)t+=Math.pow(e.signal[r],2);return t/=e.signal.length,Math.sqrt(t)},p.energy=function(e){for(var t=0,r=0;r<e.signal.length;r++)t+=Math.pow(e.signal[r],2);return t},p.zcr=function(e){for(var t=0,r=1;r<e.signal.length;r++)e.signal[r-1]>=0&&e.signal[r]<0||e.signal[r-1]<0&&e.signal[r]>=0?t++:0;return t},p.mfcc=function(e){var t=e.ampSpectrum,r=e.melFilterBank,i=e.numberOfMFCCCoefficients,a=t.length,n=new Float32Array(r.length).map(function(e,i){for(var n=0,s=0;s<a;s++)n+=r[i][s]*t[s];return n});return function(e,t){var r=new Float32Array(t);return r.forEach(function(i,a){r[a]=e.reduce(function(e,r,i){return e+r*Math.cos(a*(i+.5)*Math.PI/t)},0)}),r}(n,i)},p.chroma=function(e){var t=e.ampSpectrum,n=new Float32Array(12).fill(0),s=function(e,t){var a=t,n=Math.pow(2,(a-69)/12)*i;return e*e/(n*n)},o=function(e,t){var i=t/e*2;if(i>=17e3)return-1;return 12*Math.log2(i/440)+69},l=500,u=function(e,t){var i=t,a=12*Math.log2(i/440)+69;return r[e]-a%12};return t.forEach(function(r,i){var a=e.sampleRate*i/e.bufferSize;if(a>l&&a<l*Math.pow(2,5)){var h=o(e.bufferSize,a);if(h>0)for(var c=Math.round(h),f=c-1;f<=c+1;f++){var p=s(r,f);if("C"===(d=Object.keys(e.chromaLimits).find(function(t){return e.chromaLimits[t].includes(f%12)}))&&0===u(d,f))n[0]+=p;else if("C"==d&&-1===u(d,f))n[11]+=p;else if("C"==d&&1===u(d,f))n[1]+=p;else if("B"==d&&1===u(d,f))n[0]+=p;else{var d,g=u(d,f);n[e.chromaLimits[d][0]+g]+=p}}}}),n},p.spectralCentroid=function(e){var t=0,r=0;return e.ampSpectrum.forEach(function(i,a){t+=i,r+=i*a}),r/t*e.sampleRate/e.bufferSize},p.spectralFlatness=function(e){var t=e.ampSpectrum.reduce(function(e,t){return e+Math.log(t||1e-10)},0);return Math.exp(t/e.ampSpectrum.length)/e.ampSpectrum.reduce(function(e,t){return e+t},0)*e.ampSpectrum.length},p.spectralKurtosis=function(e){for(var t=e.spectralCentroid,r=e.spectralSpread,i=0,a=0,n=0;n<e.ampSpectrum.length;n++)i+=Math.pow(n*e.sampleRate/e.bufferSize-t,4)*Math.abs(e.ampSpectrum[n]),a+=e.ampSpectrum[n];return i/(Math.pow(r,4)*a)},p.spectralRolloff=function(e){for(var t=.99*e.ampSpectrum.reduce(function(e,t){return e+t},0),r=0,i=0;r<t;)r+=e.ampSpectrum[i],i+=1;return i/e.ampSpectrum.length*e.sampleRate/2},p.spectralSkewness=function(e){for(var t=e.spectralCentroid,r=e.spectralSpread,i=0,a=0,n=0;n<e.ampSpectrum.length;n++)i+=Math.pow(n*e.sampleRate/e.bufferSize-t,3)*e.ampSpectrum[n],a+=e.ampSpectrum[n];return i/(Math.pow(r,3)*a)},p.spectralSlope=function(e){for(var t=e.ampSpectrum,r=0,i=0,a=0,n=0,s=0;s<t.length;s++)r+=s,i+=t[s],a+=s*t[s],n+=s*s;return(t.length*a-r*i)/(t.length*n-r*r)},p.spectralSpread=function(e){var t=0,r=0,i=e.spectralCentroid;return e.ampSpectrum.forEach(function(a,n){t+=a,r+=a*Math.pow(n*e.sampleRate/e.bufferSize-i,2)}),Math.sqrt(r/t)},p.perceptualSharpness=function(e){return p.loudness(e).perceptual.sharpness},p.perceptualSpread=function(e){return p.loudness(e).perceptual.spread},p.power=function(e){for(var t=0,r=0;r<e.ampSpectrum.length;r++)t+=e.ampSpectrum[r]*e.ampSpectrum[r];return t},e.BarkScale=function(e,t,r){for(var i=new Array(e).fill(0),a=0;a<e;a++){var n=t*a/(r/2),s=13*Math.atan(.00076*n)+3.5*Math.atan(Math.pow(n/7500,2));i[a]=s}return i},e.MeydaAnalyzer=y,e.Meyda=new y.constructor,e.callbacks=[],e.featureExtractors=p,e.inputData=null,e.melToFreq=function(e){return 700*(Math.exp(e/1127)-1)},e.powerToDB=function(e){return 10*Math.log10(e)},e.utilities={},e.windowing=n,Object.defineProperty(e,"__esModule",{value:!0})});

let meyda;
let featureBuffer = [];
const MAX_FEATURE_BUFFER_LENGTH = 12; // ~320ms at typical event cadence
let centroids = [];
let currentSpeakerId = null;
let currentSegmentStartMs = 0;
let lastSpeechTimestamp = 0;
let silenceFrames = 0;
let noiseFloor = 0.003; // adaptive RMS baseline
const SILENCE_THRESHOLD_FRAMES = 10; // ~850ms of silence to close a segment
const CHANGE_THRESHOLD = 0.4; // cosine distance threshold to create new speaker
let segmentQueue = [];
let cfg = { expectedSpeakers: 2, sampleRate: 16000 };

function cosineDistance(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 1;
  let dot = 0, m1 = 0, m2 = 0;
  for (let i = 0; i < v1.length; i++) {
    const a = v1[i], b = v2[i];
    dot += a * b;
    m1 += a * a;
    m2 += b * b;
  }
  m1 = Math.sqrt(m1);
  m2 = Math.sqrt(m2);
  if (m1 === 0 || m2 === 0) return 1;
  return 1 - (dot / (m1 * m2));
}

function flushQueue() {
  if (segmentQueue.length > 0) {
    self.postMessage({ type: 'segments', payload: segmentQueue });
    segmentQueue = [];
  }
}

function endCurrentSegment(timestamp) {
  if (currentSpeakerId) {
    const endTime = lastSpeechTimestamp > 0 ? lastSpeechTimestamp : timestamp;
    if (endTime > currentSegmentStartMs) {
      segmentQueue.push({ speakerId: currentSpeakerId, startMs: currentSegmentStartMs, endMs: endTime });
      flushQueue();
    }
    currentSpeakerId = null;
    lastSpeechTimestamp = 0;
  }
}

function processFrame(frame, t0ms) {
  if (!frame || !frame.length || !meyda) return;

  meyda.signal = frame;
  meyda.process();
  const features = meyda.get(['rms', 'mfcc']);

  if (!features || !features.rms || !features.mfcc) return;

  const { rms, mfcc } = features;

  noiseFloor = (noiseFloor * 0.995) + (rms * 0.005);
  const vadThreshold = Math.max(noiseFloor * 2.5, 0.0045);

  if (rms < vadThreshold) {
    silenceFrames++;
    if (silenceFrames > SILENCE_THRESHOLD_FRAMES) {
      endCurrentSegment(t0ms);
    }
    return;
  }

  silenceFrames = 0;
  lastSpeechTimestamp = t0ms;

  if (!mfcc || !mfcc.length) return;

  if (featureBuffer.length >= MAX_FEATURE_BUFFER_LENGTH) {
    featureBuffer.shift();
  }
  featureBuffer.push(mfcc);

  if (featureBuffer.length < (MAX_FEATURE_BUFFER_LENGTH >> 1)) return;

  const dims = featureBuffer[0].length;
  const currentMean = new Array(dims).fill(0);
  for (let i = 0; i < featureBuffer.length; i++) {
    const vec = featureBuffer[i];
    for (let d = 0; d < dims; d++) currentMean[d] += vec[d];
  }
  for (let d = 0; d < dims; d++) currentMean[d] /= featureBuffer.length;

  let detectedSpeakerId;

  if (centroids.length === 0) {
    detectedSpeakerId = 'S1';
    centroids.push({ id: detectedSpeakerId, vector: currentMean.slice() });
  } else {
    const distances = centroids.map(c => cosineDistance(currentMean, c.vector));
    const minDistance = Math.min(...distances);
    const closestIdx = distances.indexOf(minDistance);

    if (minDistance > CHANGE_THRESHOLD && centroids.length < cfg.expectedSpeakers) {
      detectedSpeakerId = 'S' + (centroids.length + 1);
      centroids.push({ id: detectedSpeakerId, vector: currentMean.slice() });
    } else {
      detectedSpeakerId = centroids[closestIdx].id;
      const cvec = centroids[closestIdx].vector;
      const alpha = 0.02;
      for (let d = 0; d < dims; d++) cvec[d] = (cvec[d] * (1 - alpha)) + (currentMean[d] * alpha);
    }
  }

  if (detectedSpeakerId !== currentSpeakerId) {
    endCurrentSegment(t0ms);
    currentSpeakerId = detectedSpeakerId;
    currentSegmentStartMs = t0ms;
    self.postMessage({ type: 'activeSpeaker', payload: { speakerId: currentSpeakerId } });
  }
}

self.onmessage = (e) => {
  const { type, payload } = e.data || {};
  try {
    if (type === 'config') {
      cfg = {
        expectedSpeakers: payload.expectedSpeakers || 2,
        sampleRate: payload.sampleRate || 16000
      };
      if (!meyda) {
        meyda = self.Meyda;
        meyda._m.sampleRate = cfg.sampleRate;
        meyda._m.bufferSize = ${CHUNK_SIZE};
      }
      self.postMessage({ type: 'ready' });
    } else if (type === 'audio') {
      processFrame(payload.frame, payload.t0ms);
    } else if (type === 'stop') {
      const stopTs = payload && typeof payload.t0ms === 'number' ? payload.t0ms : (lastSpeechTimestamp || 0);
      endCurrentSegment(stopTs);
      flushQueue();
      centroids = [];
      featureBuffer = [];
      currentSpeakerId = null;
      lastSpeechTimestamp = 0;
      silenceFrames = 0;
    } else if (type === 'ping') {
        self.postMessage({ type: 'pong' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', payload: String(err) });
  }
};
`;

const useDiarization = (
  stream: MediaStream | null,
  settings: DiarizationSettings,
  startTime: number | null,
  onNewSegments: (segments: DiarizationSegment[]) => void
) => {
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  
  const workerBlobUrlRef = useRef<string | null>(null);
  const workletBlobUrlRef = useRef<string | null>(null);
  
  const segmentsRef = useRef<DiarizationSegment[]>([]);
  const totalSamplesRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const restartAttemptsRef = useRef(0);
  const MAX_RESTARTS = 3;

  const stopDiarization = useCallback(() => {
    if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (workerBlobUrlRef.current) {
      URL.revokeObjectURL(workerBlobUrlRef.current);
      workerBlobUrlRef.current = null;
    }
    if (workletBlobUrlRef.current) {
        URL.revokeObjectURL(workletBlobUrlRef.current);
        workletBlobUrlRef.current = null;
    }
    
    setActiveSpeaker(null);
    segmentsRef.current = [];
    totalSamplesRef.current = 0;
    onNewSegments([]);
  }, [onNewSegments]);

  useEffect(() => {
    let isCancelled = false;

    const start = async () => {
      if (isCancelled) return;
      
      stopDiarization();
      
      const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
      workerBlobUrlRef.current = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerBlobUrlRef.current, { type: 'classic' });
      workerRef.current = worker;

      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AC();
      audioContextRef.current = context;
      
      if (context.state === 'suspended') {
        await context.resume().catch(e => console.error("AudioContext resume failed:", e));
      }

      try {
        const workletBlob = new Blob([workletProcessorScript], { type: 'application/javascript' });
        workletBlobUrlRef.current = URL.createObjectURL(workletBlob);
        await context.audioWorklet.addModule(workletBlobUrlRef.current);
      } catch (e) {
        console.error("Error loading AudioWorklet processor:", e);
        stopDiarization();
        return;
      }
      
      if (isCancelled) return;

      const workletNode = new AudioWorkletNode(context, 'diarization-audio-processor');
      workletNodeRef.current = workletNode;

      const source = context.createMediaStreamSource(stream!);
      sourceRef.current = source;
      source.connect(workletNode);

      worker.postMessage({
        type: 'config',
        payload: {
          sampleRate: context.sampleRate,
          expectedSpeakers: settings.expectedSpeakers ?? 2
        }
      });

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const frame = event.data;
        const t0ms = startTime! + (totalSamplesRef.current / context.sampleRate) * 1000;
        totalSamplesRef.current += frame.length;

        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'audio', payload: { frame, t0ms } }, [frame.buffer]);
        }
      };

      let gotPong = true;
      heartbeatIntervalRef.current = window.setInterval(() => {
          if (!gotPong) {
              console.warn('Diarization worker seems unresponsive. It might have crashed.');
              if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
              if (restartAttemptsRef.current < MAX_RESTARTS) {
                  restartAttemptsRef.current++;
                  console.log(`Attempting to restart diarization (attempt ${restartAttemptsRef.current})...`);
                  start();
              } else {
                  console.error("Diarization failed to restart after multiple attempts.");
              }
              return;
          }
          gotPong = false;
          worker.postMessage({ type: 'ping' });
      }, 5000);

      worker.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data || {};
        if (type === 'pong') {
          gotPong = true;
          restartAttemptsRef.current = 0;
        } else if (type === 'segments' && Array.isArray(payload)) {
          segmentsRef.current = [...segmentsRef.current, ...payload];
          onNewSegments(segmentsRef.current);
        } else if (type === 'activeSpeaker') {
          setActiveSpeaker(payload?.speakerId ?? null);
        } else if (type === 'error') {
          console.error('[Diarization worker error]', payload);
        }
      };
    };

    if (stream && settings.enabled && startTime) {
      restartAttemptsRef.current = 0;
      start();
    } else {
      stopDiarization();
    }

    return () => {
      isCancelled = true;
      stopDiarization();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, settings.enabled, settings.expectedSpeakers, startTime]);

  return { activeSpeaker };
};

export default useDiarization;
