import { Component, Suspense, type ReactNode } from 'react';

export function OptionalTool({title, children}: {title: string; children: ReactNode}) {
  return <ToolBoundary title={title}><Suspense fallback={<p role="status">{title} 불러오는 중…</p>}>
    {children}
  </Suspense></ToolBoundary>;
}

class ToolBoundary extends Component<{title: string; children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    return this.state.failed ? <p role="alert">{this.props.title} 도구를 열 수 없습니다.</p> : this.props.children;
  }
}
