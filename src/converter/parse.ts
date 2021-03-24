import {
  getAlbumInfo,
  getAlbumTracks,
  getArtistInfo,
  getDiscography,
  getPlaylistInfo,
  getPlaylistTracks,
  getTrackInfo,
} from '../';
import spotifyUri from 'spotify-uri';
import * as spotify from './spotify';
import * as tidal from './tidal';
import PQueue from 'p-queue';
import type {albumType, artistInfoType, playlistInfo, trackType} from '../types';

type linkType = 'track' | 'album' | 'artist' | 'playlist';

type urlPartsType = {
  id: string;
  type:
    | 'track'
    | 'album'
    | 'audiobook'
    | 'artist'
    | 'playlist'
    | 'spotify-track'
    | 'spotify-album'
    | 'spotify-playlist'
    | 'spotify-artist'
    | 'tidal-track'
    | 'tidal-album'
    | 'tidal-playlist'
    | 'tidal-artist';
};

const queue = new PQueue({concurrency: 10});

const getUrlParts = async (url: string): Promise<urlPartsType> => {
  if (url.startsWith('spotify:')) {
    const spotify = url.split(':');
    url = 'https://open.spotify.com/' + spotify[1] + '/' + spotify[2];
  }

  const site = url.match(/deezer|spotify|tidal/);
  if (!site) {
    throw new Error('Unknown URL: ' + url);
  }

  switch (site[0]) {
    case 'deezer':
      const deezerUrlParts = url.split(/\/(\w+)\/(\d+)/);
      return {type: deezerUrlParts[1] as any, id: deezerUrlParts[2]};
    case 'spotify':
      const spotifyUrlParts = spotifyUri.parse(url);
      await spotify.setSpotifyAnonymousToken();
      return {type: ('spotify-' + spotifyUrlParts.type) as any, id: (spotifyUrlParts as any).id};
    case 'tidal':
      const tidalUrlParts = url.split(/\/(\w+)\/(\d+|\w+-\w+-\w+-\w+-\w+)/);
      return {type: ('tidal-' + tidalUrlParts[1]) as any, id: tidalUrlParts[2]};
    default:
      throw new Error('Unable to parse URL: ' + url);
  }
};

/**
 * Deezer, Spotify or Tidal links only
 * @param {String} url
 */
export const parseInfo = async (url: string) => {
  let info = await getUrlParts(url);
  if (!info.id) {
    throw new Error('Unable to parse id');
  }

  let linktype: linkType = 'track';
  let linkinfo: trackType | albumType | playlistInfo | artistInfoType | {} = {};
  let tracks: trackType[] = [];

  switch (info.type) {
    case 'track':
      tracks.push(await getTrackInfo(info.id));
      break;

    case 'album':
    case 'audiobook':
      linkinfo = await getAlbumInfo(info.id);
      linktype = 'album';
      const albumTracks = await getAlbumTracks(info.id);
      tracks = albumTracks.data;
      break;

    case 'playlist':
      linkinfo = await getPlaylistInfo(info.id);
      linktype = 'playlist';
      const playlistTracks = await getPlaylistTracks(info.id);
      tracks = playlistTracks.data;
      break;

    case 'artist':
      linkinfo = await getArtistInfo(info.id);
      linktype = 'artist';
      const artistAlbums = await getDiscography(info.id);
      await queue.addAll(
        artistAlbums.data.map((album) => {
          return async () => {
            const albumTracks = await getAlbumTracks(album.ALB_ID);
            tracks = [...tracks, ...albumTracks.data];
          };
        }),
      );
      break;

    case 'spotify-track':
      tracks.push(await spotify.track2deezer(info.id));
      break;

    case 'spotify-album':
      const [spotifyAlbumInfo, spotifyTracks] = await spotify.album2deezer(info.id);
      tracks = spotifyTracks;
      linkinfo = spotifyAlbumInfo;
      linktype = 'album';
      break;

    case 'spotify-playlist':
      const [spotifyPlaylistInfo, spotifyPlaylistTracks] = await spotify.playlist2Deezer(info.id);
      tracks = spotifyPlaylistTracks;
      linkinfo = spotifyPlaylistInfo;
      linktype = 'playlist';
      break;

    case 'spotify-artist':
      tracks = await spotify.artist2Deezer(info.id);
      linktype = 'artist';
      break;

    case 'tidal-track':
      tracks.push(await tidal.track2deezer(info.id));
      break;

    case 'tidal-album':
      const [tidalAlbumInfo, tidalAlbumTracks] = await tidal.album2deezer(info.id);
      tracks = tidalAlbumTracks;
      linkinfo = tidalAlbumInfo;
      linktype = 'album';
      break;

    case 'tidal-playlist':
      const [tidalPlaylistInfo, tidalPlaylistTracks] = await tidal.playlist2Deezer(info.id);
      tracks = tidalPlaylistTracks;
      linkinfo = tidalPlaylistInfo;
      linktype = 'playlist';
      break;

    case 'tidal-artist':
      tracks = await tidal.artist2Deezer(info.id);
      linktype = 'artist';
      break;

    default:
      throw new Error('Unknown type: ' + info.type);
  }

  return {info, linktype, linkinfo, tracks};
};