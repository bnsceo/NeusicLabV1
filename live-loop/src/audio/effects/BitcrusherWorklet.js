class NeusicBitcrusherProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.enabled=false;
    this.bits=7;
    this.reduction=4;
    this.phase=[];
    this.held=[];
    this.port.onmessage=event=>{
      const data=event.data||{};
      if(data.type==='settings'){
        this.enabled=Boolean(data.enabled);
        this.bits=Math.max(2,Math.min(16,Number(data.bits)||7));
        this.reduction=Math.max(1,Math.min(32,Math.round(Number(data.reduction)||4)));
      }
    };
  }
  process(inputs,outputs){
    const input=inputs[0],output=outputs[0];
    if(!input?.length||!output?.length)return true;
    const step=Math.pow(2,this.bits-1);
    for(let channel=0;channel<output.length;channel++){
      const src=input[Math.min(channel,input.length-1)]||input[0],dst=output[channel];
      this.phase[channel]??=0;this.held[channel]??=0;
      for(let index=0;index<dst.length;index++){
        const sample=src?.[index]||0;
        if(!this.enabled){dst[index]=sample;continue;}
        if(this.phase[channel]++%this.reduction===0)this.held[channel]=Math.round(sample*step)/step;
        dst[index]=this.held[channel];
      }
    }
    return true;
  }
}
registerProcessor('neusic-bitcrusher',NeusicBitcrusherProcessor);
