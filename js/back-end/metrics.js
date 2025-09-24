// Módulo simples de métricas em memória (formato Prometheus)
// Evita dependências externas; suficiente para primeiros painéis.

class Counter {
  constructor(name, help, labels=[]) { this.name=name; this.help=help; this.labels=labels; this.series=new Map(); }
  inc(labelValues={}, value=1){
    const key = this._key(labelValues);
    this.series.set(key,(this.series.get(key)||0)+value);
  }
  _key(obj){ return this.labels.map(l=>`${l}=${obj[l]||''}`).join(','); }
  render(){
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    for(const [k,v] of this.series.entries()){
      const labelObj = Object.fromEntries(k.split(',').filter(Boolean).map(p=>p.split('=')));
      const labelStr = Object.keys(labelObj).length?'{'+Object.entries(labelObj).map(([a,b])=>`${a}="${b}"`).join(',')+'}':'';
      out += `${this.name}${labelStr} ${v}\n`;
    }
    return out;
  }
}

class Histogram {
  constructor(name, help, buckets=[0.01,0.05,0.1,0.3,0.5,1,2,5], labels=[]) {
    this.name=name; this.help=help; this.labels=labels; this.buckets=buckets.sort((a,b)=>a-b); this.series=new Map();
  }
  observe(labelValues={}, value){
    const key = this._key(labelValues);
    if(!this.series.get(key)){
      this.series.set(key,{ counts:new Array(this.buckets.length).fill(0), sum:0, total:0 });
    }
    const obs = this.series.get(key);
    obs.sum += value; obs.total +=1;
    for(let i=0;i<this.buckets.length;i++){ if(value <= this.buckets[i]) { obs.counts[i]++; break; } }
  }
  _key(obj){ return this.labels.map(l=>`${l}=${obj[l]||''}`).join(','); }
  render(){
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    for(const [k,v] of this.series.entries()){
      const labelObj = Object.fromEntries(k.split(',').filter(Boolean).map(p=>p.split('=')));
      const baseLabels = Object.entries(labelObj).map(([a,b])=>`${a}="${b}"`).join(',');
      let acc=0;
      for(let i=0;i<this.buckets.length;i++){
        acc += v.counts[i];
        const lb = `{${baseLabels}${baseLabels? ',':''}le="${this.buckets[i]}"}`;
        out += `${this.name}_bucket${lb} ${acc}\n`;
      }
      const plusInf = `{${baseLabels}${baseLabels? ',':''}le="+Inf"}`;
      out += `${this.name}_bucket${plusInf} ${v.total}\n`;
      const common = baseLabels?'{'+baseLabels+'}':'';
      out += `${this.name}_sum${common} ${v.sum}\n`;
      out += `${this.name}_count${common} ${v.total}\n`;
    }
    return out;
  }
}

// Métricas definidas
export const metrics = {
  requests: new Counter('app_requests_total','Total de requisições HTTP',['method','route','status']),
  errors: new Counter('app_errors_total','Total de respostas de erro',['method','route','status']),
  latency: new Histogram('app_request_duration_seconds','Duração das requisições HTTP em segundos',[0.05,0.1,0.3,0.5,1,2,5],['method','route']),
  ledgerWrites: new Counter('app_ledger_writes_total','Total de escritas no ledger',['type']),
  securityEvents: new Counter('app_security_events_total','Eventos de segurança do cliente observados',['type']),
  statusClasses: new Counter('app_response_status_class_total','Total de respostas por classe HTTP',['class']),
  rateLimitHits: new Counter('app_rate_limit_hits_total','Total de ocorrências de rate limit',['route']),
  payloadBytes: new Counter('app_request_payload_bytes_total','Soma de bytes recebidos por rota',['route']),
  responseBytes: new Counter('app_response_payload_bytes_total','Soma de bytes enviados por rota',['route']),
  eventLoopLag: new Histogram('app_event_loop_lag_seconds','Lag do event loop observado',[0.01,0.05,0.1,0.3,0.5])
};

export function metricsMiddleware(req,res,next){
  const start = process.hrtime.bigint();
  res.on('finish',()=>{
    const route = req.route?.path || req.originalUrl.split('?')[0] || 'unknown';
    const durationNs = Number(process.hrtime.bigint()-start);
    const durationSec = durationNs/1e9;
    const reqLength = parseInt(req.headers['content-length']||'0',10) || 0;
    metrics.requests.inc({ method:req.method, route, status: res.statusCode });
    if(res.statusCode >=400){ metrics.errors.inc({ method:req.method, route, status: res.statusCode }); }
    metrics.latency.observe({ method:req.method, route }, durationSec);
    const cls = Math.floor(res.statusCode/100)+'xx';
    metrics.statusClasses.inc({ class: cls });
    if(reqLength>0) metrics.payloadBytes.inc({ route }, reqLength);
    if(res.getHeader && res.getHeader('content-length')){
      const outLen = parseInt(res.getHeader('content-length'),10);
      if(outLen>0) metrics.responseBytes.inc({ route }, outLen);
    }
  });
  next();
}

export function renderAllMetrics(){
  let out = '# METRICS\n';
  for(const m of Object.values(metrics)) out += m.render();
  return out;
}