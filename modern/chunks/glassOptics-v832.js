import{X as y,W as S,O as z,b as q,ay as b,a as n,az as P,j as C,ag as R}from"./three.module-v832.js";const M=`
  varying vec2 uvScreen;
  uniform sampler2D photo;
  uniform vec2 viewport, imageSize;
  uniform vec4 panes[4];
  uniform float radii[4];
  uniform float strength;
  uniform vec2 light;
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
    // Snell refraction through a rounded shoulder. The planar center has zero slope.
    float edge=1.-smoothstep(0.,min(radii[i],8.*strength),-d);
    vec3 n=normalize(vec3(normal*(edge*2.8),1.));
    vec3 ray=refract(vec3(0.,0.,-1.),n,1./1.48);
    vec2 travel=ray.xy*(12.+7.*strength)/max(.01,-ray.z);
    vec3 c=vec3(samplePhoto(pixel+travel*1.045).r,samplePhoto(pixel+travel).g,samplePhoto(pixel+travel*.965).b);
    float gleam=pow(max(dot(n,normalize(vec3(light,.70))),0.),18.)*edge;
    layer=vec4(c*.87+gleam*.48,edge*.92);

    } gl_FragColor=layer;
  }`;async function L(c,u,w){const i=await new y().loadAsync(w);let t;try{t=new S({canvas:c,alpha:!0,powerPreference:"low-power"})}catch(l){throw i.dispose(),l}const f=new z(-1,1,1,-1,0,1),v=new q,a={photo:{value:i},viewport:{value:new n},imageSize:{value:new n(i.image.width,i.image.height)},panes:{value:Array.from({length:4},()=>new b)},radii:{value:new Float32Array(4)},strength:{value:1},light:{value:new n(-.42,.62)}},h=new P(2,2),p=new C({uniforms:a,transparent:!0,vertexShader:"varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:M});v.add(new R(h,p)),t.setPixelRatio(Math.min(devicePixelRatio,1.5)),t.setClearColor(0,0);const m=new n;return{draw(l,o){const e=c.getBoundingClientRect();if(!e.width||!e.height)return;a.viewport.value.equals(m.set(e.width,e.height))||(t.setSize(Math.round(e.width),Math.round(e.height),!1),a.viewport.value.copy(m)),a.light.value.set(o?(o.x-e.left)/e.width*2-1:-.42,o?1-(o.y-e.top)/e.height*2:.62);const x=u.querySelectorAll("[data-lens]");a.panes.value.forEach((d,g)=>{const s=x[g];if(!s){d.set(0,0,0,0);return}const r=s.getBoundingClientRect();d.set(r.left-e.left+r.width/2,e.bottom-r.bottom+r.height/2,r.width/2,r.height/2),a.radii.value[g]=parseFloat(getComputedStyle(s).borderTopLeftRadius)||0}),a.strength.value={clear:1,frost:.7,prism:2.1}[l],t.render(v,f)},dispose(){i.dispose(),h.dispose(),p.dispose(),t.dispose(),t.forceContextLoss()}}}export{L as createOptics};
