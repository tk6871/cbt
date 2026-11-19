import {Component,type ReactNode} from 'react';
export default class ModelBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<p role="status">이 기기에서 3D 화면을 열 수 없습니다. 글 해설을 이용하세요.</p>:this.props.children}
}
