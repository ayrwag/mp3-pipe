import axios from "axios";
import { db } from "../firebase-admin-conf";

async function listVideos(id: string, isPlaylist = false): Promise<any> {
  let GOOGLE_API_KEY: string;
  let options;
  let url: string;

  if (isPlaylist) url = "https://www.googleapis.com/youtube/v3/playlistItems";
  else url = "https://www.googleapis.com/youtube/v3/videos";

  const headers = {
    Accept: "application/json",
  };

  const currentCredentialsRef = db
    .collection("admin")
    .doc("youtube_data_api_v3");
  try {
    const snapshot = await currentCredentialsRef.get();
    const data = snapshot.data();

    if (data) GOOGLE_API_KEY = data.GOOGLE_API_KEY;
    else {
      throw new Error(
        "listVideos: Error fetching GOOGLE_API_KEY from firestore."
      );
    }

    if (!isPlaylist) options = { part: "snippet", id, key: GOOGLE_API_KEY };
    else {
      options = {
        part: "snippet",
        playlistId: id,
        maxResults: 50,
        key: GOOGLE_API_KEY,
      };
    }

    const qs: string = new URLSearchParams(options as any).toString();

    try {
      const res = await axios.get(url + "?" + qs, { headers });
      return res.data.items;
    } catch (e) {
      console.error("listVideos: Error.", e);
      // You may want to handle the error here, depending on your use case.
      throw e; // Rethrow the error to propagate it further if necessary.
    }
  } catch (e) {
    console.error("listVideos: Error fetching credentials.", e);
    // Handle the error or return a default value if credentials cannot be
    // fetched.
    // For now, we'll rethrow the error.
    throw e;
  }
}

export const parseVideoDataFromUrl = async (url: string) => {
  const base_url = "https://youtu.be/";
  let isPlaylist;
  if (url.includes("?list=")) isPlaylist = true;
  const videos: Array<any> = [];
  if (!isPlaylist) {
    console.log("fetchVideoData: YouTube link refers to a single video");
    let videoId: any = null;
    if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1].replace(/\?.*/, "");
    } else if (url.includes("/shorts/"))
      videoId = url.split("/shorts/")[1].split("?")[0].split("&")[0];
    else videoId = url.split("/watch?v=")[1].split("&")[0];

    const videoData: Array<any> = await listVideos(videoId);
    console.log("fetchVideoData: video data is as follows...", videoData);
    const { snippet: video } = videoData[0];
    const description = video.description;
    const splitDescriptionByLine = description.split("\n");
    const descExcerpt = splitDescriptionByLine.slice(0, 3).join("\n");
    const clip = {
      title: video.title,
      uploader: video.channelTitle,
      excerpt: descExcerpt,
      url: base_url + videoId,
      thumbnail_url: video.thumbnails.maxres.url,
    };
    videos.push(clip);
    console.log("fetchVideoData: returning video data of 1 video");
    return videos;
  } else if (isPlaylist) {
    console.log("fetchVideoData: YouTube link refers to a playlist of videos");
    const playlistId = url.split("list=")[1].split("&")[0];
    const videoData = await listVideos(playlistId, true);
    videoData.forEach((videoObject: any) => {
      const { snippet: video } = videoObject;
      const description = video.description;
      const splitDescriptionByLine = description.split("\n");
      const descExcerpt = splitDescriptionByLine.slice(0, 3).join("\n");
      const thumbnailUrl =
        video.thumbnails?.maxres?.url || "https://i.ytimg.com/";
      const clip = {
        title: video.title,
        uploader: video.videoOwnerChannelTitle,
        excerpt: descExcerpt,
        url: base_url + video.resourceId.videoId,
        thumbnail_url: thumbnailUrl,
      };
      videos.push(clip);
    });
    console.log(
      `fetchVideoData: returning video data of ${videos.length} videos`
    );
    return videos;
  } else {
    throw new Error(
      "fetchVideoData: failed. link is neither playlist nor video."
    );
  }
};
