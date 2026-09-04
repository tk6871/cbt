import { createApp, type App, type Component } from 'vue';
import FrameworkSandboxApp, { type FrameworkAdapter } from './FrameworkSandboxApp.vue';
import { frameworkByKey, type FrameworkKey } from './catalog';
import './sandbox.css';
import './sandboxLayouts.css';

type Setup = (app: App) => void;

const nativeAdapter: FrameworkAdapter = {
  button: 'button',
  buttonProps: () => ({ type: 'button' }),
  loadedLabel: '기본 HTML 컨트롤을 사용 중',
};

function adapter(
  button: Component | string,
  loadedLabel: string,
  buttonProps: FrameworkAdapter['buttonProps'],
  noButtonSlot = false,
): FrameworkAdapter {
  return { button, loadedLabel, buttonProps, noButtonSlot };
}

async function loadFramework(key: FrameworkKey): Promise<{ adapter: FrameworkAdapter; setup?: Setup }> {
  switch (key) {
    case 'reka': {
      const reka = await import('reka-ui');
      return { adapter: adapter(reka.Primitive, 'Reka UI Primitive을 실제로 불러옴', () => ({ as: 'button', type: 'button' })) };
    }
    case 'vuetify': {
      const [{ createVuetify }, components] = await Promise.all([import('vuetify'), import('vuetify/components'), import('vuetify/styles')]);
      const vuetify = createVuetify({ components: { VBtn: components.VBtn } });
      return { adapter: adapter(components.VBtn, 'Vuetify VBtn을 실제로 불러옴', () => ({ color: 'primary', variant: 'flat', size: 'small' })), setup: (app) => app.use(vuetify) };
    }
    case 'primevue': {
      const [{ default: PrimeVue }, { default: Aura }, { default: Button }] = await Promise.all([
        import('primevue/config'), import('@primeuix/themes/aura'), import('primevue/button'),
      ]);
      return { adapter: adapter(Button, 'PrimeVue Button + Aura를 실제로 불러옴', (label) => ({ label, size: 'small' }), true), setup: (app) => app.use(PrimeVue, { theme: { preset: Aura } }) };
    }
    case 'naive': {
      const { NButton } = await import('naive-ui');
      return { adapter: adapter(NButton, 'Naive UI NButton을 실제로 불러옴', () => ({ type: 'primary', size: 'small' })) };
    }
    case 'quasar': {
      const [{ Quasar, QBtn }] = await Promise.all([import('quasar'), import('quasar/dist/quasar.css')]);
      return { adapter: adapter(QBtn, 'Quasar QBtn을 실제로 불러옴', (label) => ({ label, color: 'primary', unelevated: true, size: 'sm' }), true), setup: (app) => app.use(Quasar) };
    }
    case 'element': {
      const element = await import('element-plus');
      await import('element-plus/dist/index.css');
      return { adapter: adapter(element.ElButton, 'Element Plus ElButton을 실제로 불러옴', () => ({ type: 'primary' })) };
    }
    case 'ant': {
      const ant = await import('ant-design-vue');
      await import('ant-design-vue/dist/reset.css');
      return { adapter: adapter(ant.Button, 'Ant Design Vue Button을 실제로 불러옴', () => ({ type: 'primary' })) };
    }
    case 'bootstrap': {
      const [bootstrapVue] = await Promise.all([import('bootstrap-vue-next'), import('bootstrap/dist/css/bootstrap.min.css'), import('bootstrap-vue-next/dist/bootstrap-vue-next.css')]);
      return { adapter: adapter(bootstrapVue.BButton, 'BootstrapVueNext BButton을 실제로 불러옴', () => ({ variant: 'primary', size: 'sm' })) };
    }
    case 'vuestic': {
      const [{ VaButton, createVuestic }] = await Promise.all([import('vuestic-ui'), import('vuestic-ui/css')]);
      return { adapter: adapter(VaButton, 'Vuestic UI VaButton을 실제로 불러옴', () => ({ color: 'primary', size: 'small' })), setup: (app) => app.use(createVuestic()) };
    }
    case 'arco': {
      const arco = await import('@arco-design/web-vue');
      await import('@arco-design/web-vue/dist/arco.css');
      return { adapter: adapter(arco.Button, 'Arco Design Button을 실제로 불러옴', () => ({ type: 'primary', size: 'small' })), setup: (app) => app.use(arco.default) };
    }
    case 'tdesign': {
      const tdesign = await import('tdesign-vue-next');
      await import('tdesign-vue-next/dist/tdesign.css');
      return { adapter: adapter(tdesign.Button, 'TDesign Button을 실제로 불러옴', () => ({ theme: 'primary', size: 'small' })), setup: (app) => app.use(tdesign.default) };
    }
    case 'viewui': {
      const view = await import('view-ui-plus');
      await import('view-ui-plus/dist/styles/viewuiplus.css');
      return { adapter: adapter(view.default.Button, 'View UI Plus Button을 실제로 불러옴', () => ({ type: 'primary' })), setup: (app) => app.use(view.default) };
    }
    case 'vant': {
      const vant = await import('vant');
      await import('vant/lib/index.css');
      return { adapter: adapter(vant.Button, 'Vant Button을 실제로 불러옴', (label) => ({ text: label, type: 'primary', size: 'small' }), true) };
    }
    case 'varlet': {
      const varletUi = await import('@varlet/ui');
      await import('@varlet/ui/es/varlet.css');
      return { adapter: adapter(varletUi.Button, 'Varlet Button을 실제로 불러옴', () => ({ type: 'primary' })), setup: (app) => app.use(varletUi.default) };
    }
    case 'oruga': {
      const oruga = await import('@oruga-ui/oruga-next');
      return { adapter: adapter(oruga.OButton, 'Oruga OButton을 실제로 불러옴', () => ({ variant: 'primary' })), setup: (app) => app.use(oruga.default) };
    }
    case 'wave': {
      const [{ default: WaveUI }] = await Promise.all([import('wave-ui'), import('wave-ui/dist/wave-ui.css')]);
      return { adapter: adapter('WButton', 'Wave UI WButton을 실제로 불러옴', () => ({ bgColor: 'primary' })), setup: (app) => app.use(WaveUI) };
    }
    case 'ionic': {
      const ionic = await import('@ionic/vue');
      await Promise.all([import('@ionic/vue/css/core.css'), import('@ionic/vue/css/normalize.css'), import('@ionic/vue/css/typography.css')]);
      return { adapter: adapter(ionic.IonButton, 'Ionic Vue IonButton을 실제로 불러옴', () => ({ color: 'primary', size: 'small' })), setup: (app) => app.use(ionic.IonicVue) };
    }
    case 'framework7': {
      const [{ default: Framework7Vue, f7Button }, { default: Framework7 }] = await Promise.all([
        import('framework7-vue'), import('framework7/lite-bundle'), import('framework7/css/bundle'),
      ]);
      Framework7.use(Framework7Vue);
      return { adapter: adapter(f7Button, 'Framework7 f7Button을 실제로 불러옴', () => ({ fill: true, small: true })), setup: (app) => app.use(Framework7Vue) };
    }
    case 'kendo': {
      const [{ Button }] = await Promise.all([import('@progress/kendo-vue-buttons'), import('@progress/kendo-theme-default/dist/all.css')]);
      return { adapter: adapter(Button, 'Kendo UI Button 평가판을 실제로 불러옴', () => ({ themeColor: 'primary', size: 'medium' })) };
    }
    case 'devextreme': {
      const [{ DxButton }] = await Promise.all([import('devextreme-vue/button'), import('devextreme/dist/css/dx.fluent.blue.light.css')]);
      return { adapter: adapter(DxButton, 'DevExtreme DxButton 평가판을 실제로 불러옴', (label) => ({ text: label, type: 'default', stylingMode: 'contained' }), true) };
    }
    default:
      return { adapter: nativeAdapter };
  }
}

async function mount(): Promise<void> {
  const info = frameworkByKey(new URLSearchParams(location.search).get('framework'));
  document.documentElement.dataset.framework = info.key;
  try {
    const loaded = await loadFramework(info.key);
    const app = createApp(FrameworkSandboxApp, { info, adapter: loaded.adapter });
    loaded.setup?.(app);
    app.mount('#ui-framework-sandbox');
  } catch (error) {
    console.error(`${info.name} 체험 컴포넌트를 불러오지 못했습니다.`, error);
    const fallback = { ...nativeAdapter, loadedLabel: `${info.name} 화면 · 기본 컨트롤 대체 표시` };
    createApp(FrameworkSandboxApp, { info, adapter: fallback }).mount('#ui-framework-sandbox');
  }
}

void mount();
