import axios, {AxiosRequestConfig} from 'axios';
import delay from 'delay';

const ARL =
  'a62f40421c53479e411c78cd7420f7e40e7de97ab9e6436558145bcedf4557bc79946e96c02d7fef9a3166024a11c4a501236eca892b1ef989267244153af6efc4fec75d47a776129e971a4c68cef0b33b1633baf0eb0e8c08e170224e9527fc';
const APIPayload = {
  version: '8.32.0',
  api_key: 'ZAIVAHCEISOHWAICUQUEXAEPICENGUAFAEZAIPHAELEEVAHPHUCUFONGUAPASUAY',
  output: 3,
  input: 3,
  buildId: 'ios12_universal',
  screenHeight: '480',
  screenWidth: '320',
  lang: 'en',
};

const instance = axios.create({
  baseURL: 'https://api.deezer.com/1.0',
  withCredentials: true,
  timeout: 10000,
  headers: {
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json; charset=UTF-8',
    'User-Agent': 'Deezer/8.32.0.2 (iOS; 14.4; Mobile; en; iPhone10_5)',
  },
  params: APIPayload,
  data: APIPayload,
});

export const initDeezerApi = async (arl: string): Promise<string> => {
  const options: AxiosRequestConfig = {
    params: {
      method: 'deezer.ping',
      api_version: '1.0',
      api_token: '',
    },
  };
  if (arl) {
    options.headers = {cookie: 'arl=' + arl};
  }

  const {data} = await instance.get('https://www.deezer.com/ajax/gw-light.php', options);
  instance.defaults.params.sid = data.results.SESSION;
  return data.results.SESSION;
};

// Add a request interceptor
instance.interceptors.response.use(async (response) => {
  if (response.data.error && Object.keys(response.data.error).length > 0) {
    if (response.data.error.NEED_API_AUTH_REQUIRED) {
      await initDeezerApi(ARL);
      return await instance(response.config);
    } else if (response.data.error.code == 4) {
      await delay(1000);
      return await instance(response.config);
    }
  }

  return response;
});

export default instance;