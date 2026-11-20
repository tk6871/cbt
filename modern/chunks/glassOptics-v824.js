import{T as f,W as w,O as x,S as y,V as S,a as d,P as q,b,M as P}from"./three.module-v824.js";const C=""+new URL("../assets/glass-lake-CRZnh9qB.webp",import.meta.url).href,z=`
  varying vec2 uvScreen;
  uniform sampler2D photo;
  uniform vec2 viewport, imageSize;
  uniform vec4 panes[4];
  uniform float radii[4];
  uniform float strength;
  vec3 samplePhoto(vec2 pixel){
    float ratio=viewport.x*imageSize.y/(viewport.y*imageSize.x);
    vec2 crop=min(vec2(1.),vec2(ratio,1./ratio));
    return texture2D(photo,clamp((pixel/viewport-.5)*crop+.5,0.,1.)).rgb;
  }
  void main(){
    vec2 pixel=uvScreen*viewport; vec4 layer=vec4(0.);
    for(int i=0;i<4;i++){vec4 pane=panes[i]; if(pane.z<=0.)continue;
    vec2 rel=pixel-pane.xy;
    vec2 q=abs(rel)-pane.zw+radii[i];
    float d=length(max(q,0.))+min(max(q.x,q.y),0.)-radii[i];
    if(d>0.)continue;
    vec2 normal=q.x>q.y?vec2(sign(rel.x),0.):vec2(0.,sign(rel.y));
    if(max(q.x,q.y)>0.)normal=normalize(max(q,0.)*sign(rel));
    float edge=exp(d/(4.*strength));
    vec2 shift=normal*edge*strength*13.;
    vec3 c=vec3(samplePhoto(pixel-shift*1.15).r,samplePhoto(pixel-shift).g,samplePhoto(pixel-shift*.83).b);
    layer=vec4(c*.88+max(dot(normal,vec2(-.6,.8)),0.)*edge*.22,edge*.94);
    } gl_FragColor=layer;
  }`;async function M(s,m){const a=await new f().loadAsync(C);let t;try{t=new w({canvas:s,alpha:!0,powerPreference:"low-power"})}catch(o){throw a.dispose(),o}const g=new x(-1,1,1,-1,0,1),l=new y,i={photo:{value:a},viewport:{value:new d},imageSize:{value:new d(a.image.width,a.image.height)},panes:{value:Array.from({length:4},()=>new S)},radii:{value:new Float32Array(4)},strength:{value:1}},c=new q(2,2),p=new b({uniforms:i,transparent:!0,vertexShader:"varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:z});return l.add(new P(c,p)),t.setPixelRatio(Math.min(devicePixelRatio,1.5)),t.setClearColor(0,0),{draw(o){const e=s.getBoundingClientRect();if(!e.width||!e.height)return;t.setSize(Math.round(e.width),Math.round(e.height),!1),i.viewport.value.set(e.width,e.height);const u=m.querySelectorAll("[data-lens]");i.panes.value.forEach((h,v)=>{const n=u[v];if(!n){h.set(0,0,0,0);return}const r=n.getBoundingClientRect();h.set(r.left-e.left+r.width/2,e.bottom-r.bottom+r.height/2,r.width/2,r.height/2),i.radii.value[v]=parseFloat(getComputedStyle(n).borderTopLeftRadius)||0}),i.strength.value={clear:1,frost:.7,prism:2.1}[o],t.render(l,g)},dispose(){a.dispose(),c.dispose(),p.dispose(),t.dispose(),t.forceContextLoss()}}}export{M as createOptics};
