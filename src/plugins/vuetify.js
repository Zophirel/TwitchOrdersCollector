import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi
    }
  },
  theme: {
    defaultTheme: 'collectorDark',
    themes: {
      collectorDark: {
        dark: true,
        colors: {
          background: '#0d1117',
          surface: '#151b23',
          primary: '#62c4ff',
          secondary: '#2a3542',
          error: '#ef6b73',
          success: '#47c27d',
          warning: '#f5b74a'
        }
      }
    }
  }
});
