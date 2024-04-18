"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVideoDataFromUrl = void 0;
const axios_1 = __importDefault(require("axios"));
const firebase_admin_conf_1 = require("../firebase-admin-conf");
function listVideos(id_1) {
    return __awaiter(this, arguments, void 0, function* (id, isPlaylist = false) {
        let GOOGLE_API_KEY;
        let options;
        let url;
        if (isPlaylist)
            url = "https://www.googleapis.com/youtube/v3/playlistItems";
        else
            url = "https://www.googleapis.com/youtube/v3/videos";
        const headers = {
            Accept: "application/json",
        };
        const currentCredentialsRef = firebase_admin_conf_1.db
            .collection("admin")
            .doc("youtube_data_api_v3");
        try {
            const snapshot = yield currentCredentialsRef.get();
            const data = snapshot.data();
            if (data)
                GOOGLE_API_KEY = data.GOOGLE_API_KEY;
            else {
                throw new Error("listVideos: Error fetching GOOGLE_API_KEY from firestore.");
            }
            if (!isPlaylist)
                options = { part: "snippet", id, key: GOOGLE_API_KEY };
            else {
                options = {
                    part: "snippet",
                    playlistId: id,
                    maxResults: 50,
                    key: GOOGLE_API_KEY,
                };
            }
            const qs = new URLSearchParams(options).toString();
            try {
                const res = yield axios_1.default.get(url + "?" + qs, { headers });
                return res.data.items;
            }
            catch (e) {
                console.error("listVideos: Error.", e);
                // You may want to handle the error here, depending on your use case.
                throw e; // Rethrow the error to propagate it further if necessary.
            }
        }
        catch (e) {
            console.error("listVideos: Error fetching credentials.", e);
            // Handle the error or return a default value if credentials cannot be
            // fetched.
            // For now, we'll rethrow the error.
            throw e;
        }
    });
}
const parseVideoDataFromUrl = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const base_url = "https://youtu.be/";
    let isPlaylist;
    if (url.includes("?list="))
        isPlaylist = true;
    const videos = [];
    if (!isPlaylist) {
        console.log("fetchVideoData: YouTube link refers to a single video");
        let videoId = null;
        if (url.includes("youtu.be/")) {
            videoId = url.split("youtu.be/")[1].replace(/\?.*/, "");
        }
        else if (url.includes("/shorts/"))
            videoId = url.split("/shorts/")[1].split("?")[0].split("&")[0];
        else
            videoId = url.split("/watch?v=")[1].split("&")[0];
        const videoData = yield listVideos(videoId);
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
    }
    else if (isPlaylist) {
        console.log("fetchVideoData: YouTube link refers to a playlist of videos");
        const playlistId = url.split("list=")[1].split("&")[0];
        const videoData = yield listVideos(playlistId, true);
        videoData.forEach((videoObject) => {
            var _a, _b;
            const { snippet: video } = videoObject;
            const description = video.description;
            const splitDescriptionByLine = description.split("\n");
            const descExcerpt = splitDescriptionByLine.slice(0, 3).join("\n");
            const thumbnailUrl = ((_b = (_a = video.thumbnails) === null || _a === void 0 ? void 0 : _a.maxres) === null || _b === void 0 ? void 0 : _b.url) || "https://i.ytimg.com/";
            const clip = {
                title: video.title,
                uploader: video.videoOwnerChannelTitle,
                excerpt: descExcerpt,
                url: base_url + video.resourceId.videoId,
                thumbnail_url: thumbnailUrl,
            };
            videos.push(clip);
        });
        console.log(`fetchVideoData: returning video data of ${videos.length} videos`);
        return videos;
    }
    else {
        throw new Error("fetchVideoData: failed. link is neither playlist nor video.");
    }
});
exports.parseVideoDataFromUrl = parseVideoDataFromUrl;
