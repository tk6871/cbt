import {Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, TextureLoader, Vector2, Vector4, WebGLRenderer} from 'three';
import type {GlassMaterial} from './glassMaterial';

// Refract the underlying photo only at the curved edge of the sample pane.
const fragmentShader = `
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
  }`;
export async function createOptics(canvas:HTMLCanvasElement,host:HTMLElement,artUrl:string){
  const texture=await new TextureLoader().loadAsync(artUrl);
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas,alpha:true,powerPreference:'low-power'});}
  catch(error){texture.dispose();throw error;}
  const camera=new OrthographicCamera(-1,1,1,-1,0,1), scene=new Scene();
  const uniforms={photo:{value:texture},viewport:{value:new Vector2()},imageSize:{value:new Vector2(texture.image.width,texture.image.height)},panes:{value:Array.from({length:4},()=>new Vector4())},radii:{value:new Float32Array(4)},strength:{value:1},light:{value:new Vector2(-.42,.62)}};
  const geometry=new PlaneGeometry(2,2);
  const material=new ShaderMaterial({uniforms,transparent:true,vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader});
  scene.add(new Mesh(geometry,material));renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);
  const size=new Vector2();
  return {draw(style:GlassMaterial, pointer?:{x:number;y:number}){
    const box=canvas.getBoundingClientRect();
    if(!box.width||!box.height)return;
    if(!uniforms.viewport.value.equals(size.set(box.width,box.height))){
      renderer.setSize(Math.round(box.width),Math.round(box.height),false);uniforms.viewport.value.copy(size);
    }
    uniforms.light.value.set(pointer?(pointer.x-box.left)/box.width*2-1:-.42,pointer?1-(pointer.y-box.top)/box.height*2:.62);
    const panes=host.querySelectorAll<HTMLElement>('[data-lens]');
    uniforms.panes.value.forEach((rect,i)=>{
      const el=panes[i];
      if(!el){rect.set(0,0,0,0);return;}
      const p=el.getBoundingClientRect();
      rect.set(p.left-box.left+p.width/2,box.bottom-p.bottom+p.height/2,p.width/2,p.height/2);
      uniforms.radii.value[i]=parseFloat(getComputedStyle(el).borderTopLeftRadius)||0;
    });
    uniforms.strength.value={clear:1,frost:.7,prism:2.1}[style];renderer.render(scene,camera);
  },dispose(){texture.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
