import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import 'vuetify/styles';

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'snapDark',
      themes: {
        snapDark: {
          dark: true,
          colors: {
            background: '#0b1120',
            surface: '#111827',
            primary: '#38bdf8',
            secondary: '#6366f1',
            error: '#f87171',
            info: '#7dd3fc',
            success: '#4ade80',
            warning: '#fbbf24',
          },
        },
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
