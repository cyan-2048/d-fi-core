import type {albumTracksType} from './album';

export interface profileType {
  IS_FOLLOW: boolean;
  NB_ARTISTS: number;
  NB_FOLLOWERS: number;
  NB_FOLLOWINGS: number;
  NB_MP3S: number;
  TOP_TRACK: albumTracksType;
  USER: {
    USER_ID: string; // '2064440442'
    BLOG_NAME: string; // 'sayem314'
    SEX?: string; // ''
    COUNTRY: string; // 'BD'
    USER_PICTURE?: string; // ''
    COUNTRY_NAME: string; // 'Bangladesh'
    PRIVATE: boolean;
    DISPLAY_NAME: string; // 'sayem314'
    __TYPE__: 'user';
  };
}
