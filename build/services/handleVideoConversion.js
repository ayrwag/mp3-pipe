"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getVideoOrPlaylistId = exports.downloadVideo = void 0;
const firebase_admin_conf_1 = __importDefault(require("../firebase-admin-conf"));
const child_process_1 = require("child_process");
const fluent_ffmpeg_7_1 = __importDefault(require("fluent-ffmpeg-7"));
const stream = __importStar(require("stream"));
const { PassThrough } = stream;
function downloadVideo(idObject_1, videoTitle_1) {
    return __awaiter(this, arguments, void 0, function* (idObject, videoTitle, more = { is: null }, archive = null) {
        let url;
        try {
            url = `https://youtube.com/watch?v=${idObject.videoId}`;
            // console.log("downloadVideo: This is the url:", url);
            const options = [
                url,
                "bestaudio/best", // Specify the format you want to download (best audio in this case)
                "--output",
                "-" // Output to stdout
            ];
            let fileRef;
            let outStream;
            if (!more.is) {
                fileRef = firebase_admin_conf_1.default.file(`${videoTitle}.mp3`);
                outStream = fileRef.createWriteStream(); //for some reason when adding contentType metadata, it bugs out lol
            }
            else {
                outStream = new PassThrough();
                function onDataDrained() {
                    console.log(`Data has been drained (${more.index + 1})`);
                    outStream.removeListener('end', onDataDrained);
                }
                if (archive)
                    archive.append(outStream, { name: `${more.index + 1} ${videoTitle}.mp3` });
                else {
                    throw new Error(`downloadVideo: playlists must be passed an archive object!`);
                }
                outStream.on('end', onDataDrained);
                archive.on('warning', function (err) {
                    if (err.code === 'ENOENT') {
                        console.log('warning:', err);
                    }
                    else {
                        // throw error
                        throw err;
                    }
                });
                archive.on('error', function (err) {
                    throw err;
                });
            }
            return new Promise((resolve, reject) => {
                try {
                    const ytdlProcess = (0, child_process_1.spawn)('yt-dlp', options);
                    const passThroughStream = new PassThrough();
                    ytdlProcess.stdout.pipe(passThroughStream);
                    /* eslint-disable new-cap */
                    ytdlProcess.on("spawn", function () {
                        console.log("ytdlprocess started! for video", videoTitle);
                    });
                    (0, fluent_ffmpeg_7_1.default)(passThroughStream)
                        .noVideo()
                        .audioCodec("libmp3lame")
                        .format('mp3')
                        .on("start", function (commandLine) {
                        console.log("Spawned Ffmpeg with command: " + commandLine);
                    })
                        .on("error", function error(err) {
                        console.error("ffmpeg - An error has occurred:", err.message);
                        // Handle the error here, you might want to close the outStream and take appropriate actions.
                        outStream.end();
                        reject(new Error("ffmpeg: Operation failed"));
                    })
                        .output(outStream, { end: true })
                        .on("end", function () {
                        console.log("ffmpeg: Processing finished.");
                        // Close the outStream here if you haven't already.
                        outStream.end();
                    }).run();
                    ytdlProcess.on("error", (err) => {
                        console.error("youtube-dl process error:", err.message);
                        // Close the outStream on error
                        // outStream.end();
                        reject(new Error("youtube-dl process error"));
                    });
                    ytdlProcess.on("close", (code) => {
                        console.log(`ytdlProcess: youtube-dl process finished successfully.(exit code ${code})`);
                        // outStream.end();
                    });
                }
                catch (error) {
                    console.error(error);
                    // Handle the error here, you might want to close the outStream and take appropriate actions.
                    outStream.end();
                    reject(new Error("downloadVideo: try-block failed"));
                }
                outStream.on('close', () => {
                    if (!more.is && fileRef) {
                        const h = 60 * 60 * 1000;
                        console.log(`outStream: closed, fetching url...`);
                        fileRef.getSignedUrl({ action: 'read', expires: Date.now() + (24 * h) })
                            .then((res) => {
                            const [url] = res;
                            resolve(url);
                        });
                    }
                    else
                        resolve();
                });
            });
        }
        catch (err) {
            console.error(`downloadVideo, No videoId property in idObject argument. Url is unsettable`);
        }
    });
}
exports.downloadVideo = downloadVideo;
function getVideoOrPlaylistId(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let isPlaylist;
        if (url.includes('?list='))
            isPlaylist = true;
        else
            isPlaylist = false;
        if (isPlaylist) {
            console.log("It's a playlist.. Hehe, no code for that yet!");
            const playlistId = url.split('list=')[1].split('&')[0];
            return { isPlaylist, playlistId };
        }
        else {
            let videoId = null;
            if (url.includes('youtu.be/'))
                videoId = url.split('youtu.be/')[1].replace(/\?.*/, '');
            else if (url.includes('/shorts/'))
                videoId = url.split('/shorts/')[1].split('?')[0].split('&')[0];
            else
                videoId = url.split('/watch?v=')[1].split('&')[0];
            return { isPlaylist, videoId };
        }
    });
}
exports.getVideoOrPlaylistId = getVideoOrPlaylistId;
