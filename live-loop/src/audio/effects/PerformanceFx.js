export class PerformanceFx {
  constructor(context){
    this.context=context;
    this.input=context.createGain();
    this.output=context.createGain();
    this.filter=context.createBiquadFilter();
    this.filter.type='lowpass';
    this.filter.frequency.value=18000;
    this.drive=context.createWaveShaper();
    this.drive.oversample='2x';
    this.drive.curve=this.makeCurve(0);
    this.crusher=null;
    this.lofi=false;
    this.input.connect(this.filter);
    this.filter.connect(this.drive);
    this.drive.connect(this.output);
  }
  makeCurve(amount=0){
    const size=2048,curve=new Float32Array(size),k=Math.max(0,amount)*45;
    for(let index=0;index<size;index++){
      const x=index*2/(size-1)-1;
      curve[index]=k?((1+k)*x)/(1+k*Math.abs(x)):x;
    }
    return curve;
  }
  async init(){
    if(this.crusher||!this.context.audioWorklet)return this;
    try{
      await this.context.audioWorklet.addModule('./src/audio/effects/BitcrusherWorklet.js');
      this.crusher=new AudioWorkletNode(this.context,'neusic-bitcrusher',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
      this.filter.disconnect();
      this.filter.connect(this.crusher);
      this.crusher.connect(this.drive);
    }catch(error){console.warn('Neusic bitcrusher worklet unavailable; using filter/drive fallback.',error);}
    return this;
  }
  setLoFi(enabled){
    this.lofi=Boolean(enabled);
    const now=this.context.currentTime;
    this.filter.frequency.setTargetAtTime(this.lofi?4300:18000,now,.025);
    this.drive.curve=this.makeCurve(this.lofi?.42:0);
    this.crusher?.port.postMessage({type:'settings',enabled:this.lofi,bits:6,reduction:5});
  }
  toggleLoFi(){this.setLoFi(!this.lofi);return this.lofi;}
}
