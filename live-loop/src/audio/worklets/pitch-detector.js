class PitchDetectorProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.buffer=new Float32Array(2048);
    this.writeIndex=0;
    this.samplesSinceCheck=0;
  }
  process(inputs,outputs){
    const input=inputs[0],output=outputs[0];
    if(!input?.length){return true;}
    for(let channel=0;channel<output.length;channel++){
      const source=input[Math.min(channel,input.length-1)];
      if(source)output[channel].set(source);
    }
    const mono=input[0];
    for(let i=0;i<mono.length;i++){
      this.buffer[this.writeIndex]=mono[i];
      this.writeIndex=(this.writeIndex+1)%this.buffer.length;
      this.samplesSinceCheck++;
    }
    if(this.samplesSinceCheck>=256){this.samplesSinceCheck=0;this.detect();}
    return true;
  }
  detect(){
    const frame=new Float32Array(this.buffer.length),start=this.writeIndex;
    let energy=0;
    for(let i=0;i<frame.length;i++){const value=this.buffer[(start+i)%this.buffer.length];frame[i]=value;energy+=value*value;}
    const rms=Math.sqrt(energy/frame.length);
    if(rms<0.012){this.port.postMessage({frequency:0,confidence:0,voiced:false});return;}
    let bestLag=0,bestScore=0;
    const minLag=Math.floor(sampleRate/1000),maxLag=Math.floor(sampleRate/55);
    for(let lag=minLag;lag<=maxLag;lag++){
      let numerator=0,denominator=0;
      for(let i=0;i<frame.length-lag;i++){const a=frame[i],b=frame[i+lag];numerator+=a*b;denominator+=a*a+b*b;}
      const score=denominator?2*numerator/denominator:0;
      if(score>bestScore){bestScore=score;bestLag=lag;}
    }
    const voiced=bestLag>0&&bestScore>=0.55;
    this.port.postMessage({frequency:voiced?sampleRate/bestLag:0,confidence:Math.max(0,Math.min(1,bestScore)),voiced});
  }
}
registerProcessor('neusic-pitch-detector',PitchDetectorProcessor);
