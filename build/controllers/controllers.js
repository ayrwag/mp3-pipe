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
exports.handleVideoConversion = exports.handleYouTubeLink = void 0;
const firebase_admin_conf_1 = __importStar(require("../firebase-admin-conf"));
const archiver_1 = __importDefault(require("archiver"));
const axios_1 = __importDefault(require("axios"));
const async_1 = __importDefault(require("async"));
const handleVideoConversion_1 = require("../services/handleVideoConversion");
const handleYouTubeLink_1 = require("../services/handleYouTubeLink");
/** the whole Process
 * get the urls for each video if it's a playlist
 * for each url, download it to firebase cloud storage, as an MP3
    //spawn an ffmpeg instance and a youtube-dl instance
    //stream the youtube's data through ytdl to ffmpeg
    //stream the output to firebase cloud storage
    * res.send a URI for client to access the downlaod.
*/
const handleYouTubeLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // code for handling YouTube links
    try {
        const url = req.query.url;
        if (typeof url !== 'string')
            throw new Error('url query parameter is malformed or missing');
        console.log("handleYouTubeLink: fetching video data from the link.");
        const videoData = yield (0, handleYouTubeLink_1.parseVideoDataFromUrl)(url);
        console.log("handleYouTubeLink: videoData request successful.");
        console.log("handleYoutubeLink: sending videoData as a response.");
        res.send(videoData);
    }
    catch (error) {
        console.error("handleYouTubeLink: Error fetching video data from URL.", error);
    }
});
exports.handleYouTubeLink = handleYouTubeLink;
function handleVideoConversion(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let { url } = req.body; //set in request body
        let { videoData } = req.body; //set in request body
        if (!url) {
            videoData = req.body;
            url = req.body[0].url;
        }
        if (!(videoData === null || videoData === void 0 ? void 0 : videoData.length))
            throw new Error("ConvertVideo: Request body is malformed or missing");
        const resourceId = yield (0, handleVideoConversion_1.getVideoOrPlaylistId)(url);
        const h = 60 * 60 * 1000;
        if (resourceId.isPlaylist) {
            try {
                const playlistTitle = yield (() => __awaiter(this, void 0, void 0, function* () {
                    const apiUrl = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet&id=${resourceId.playlistId}&key=`;
                    const doc = yield firebase_admin_conf_1.db.collection('admin').doc('youtube_data_api_v3').get();
                    const { GOOGLE_API_KEY } = doc.data();
                    const response = yield axios_1.default.get(apiUrl + GOOGLE_API_KEY);
                    const { items } = response.data;
                    console.log(`this is items!!:`, items);
                    const { title } = items[0].snippet;
                    return title;
                }))();
                const filePath = `playlists/${playlistTitle} (${resourceId.playlistId}).zip`;
                const fileRef = firebase_admin_conf_1.default.file(filePath);
                try {
                    const [fileData] = yield fileRef.get();
                    if (fileData) {
                        fileRef.getSignedUrl({ action: 'read', expires: Date.now() + (24 * h) })
                            .then(([url]) => {
                            res.status(200).send({ msg: `Playlist conversion was a success (${playlistTitle})`, playlistPath: url });
                        })
                            .catch((err) => {
                            console.error(`zipDownload: Error fetching signed url from fileRef:`, err);
                        });
                        return;
                    }
                }
                catch (err) {
                    console.log(`fileRef: No such file found in db. Continuing with conversion.`);
                    // console.error(err)
                }
                const output = fileRef.createWriteStream();
                const archive = (0, archiver_1.default)('zip', {
                    zlib: { level: 9 } // Sets the compression level.
                });
                output.on('close', function () {
                    console.log(archive.pointer() + ' total bytes');
                    console.log('archiver has been finalized and the output file descriptor has closed.');
                });
                archive.pipe(output);
                //download videos in a for loop
                function processVideoData(videoData, archive) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let index = 0;
                        const concurrencyLimit = 3; // Adjust as needed
                        // Create an asynchronous task queue with a concurrency limit
                        const taskQueue = async_1.default.queue((taskData, callback) => __awaiter(this, void 0, void 0, function* () {
                            let { video, index } = taskData;
                            const idObject = yield (0, handleVideoConversion_1.getVideoOrPlaylistId)(video.url);
                            yield (0, handleVideoConversion_1.downloadVideo)(idObject, video.title, { is: true, index }, archive);
                            callback(); // Signal that the task is complete
                        }), concurrencyLimit);
                        // Add tasks to the queue
                        videoData.forEach((video) => {
                            taskQueue.push({ video, index }, () => {
                                console.log(`Download complete for ${video.title}`);
                            });
                            index++;
                        });
                        // Wait for all tasks in the queue to complete
                        yield new Promise((resolve) => {
                            taskQueue.drain(() => {
                                console.log('All videos processed.');
                                resolve();
                            });
                        });
                    });
                }
                processVideoData(videoData, archive)
                    .then(() => {
                    archive.finalize();
                    if (fileRef) {
                        fileRef.getSignedUrl({ action: 'read', expires: Date.now() + (24 * h) })
                            .then(([url]) => {
                            res.status(200).send({ msg: `Playlist conversion was a success (${playlistTitle})`, playlistPath: url });
                        })
                            .catch((err) => {
                            console.error(`zipDownload: Error fetching signed url from fileRef:`, err);
                        });
                    }
                });
            }
            catch (error) {
                console.error(`downloadVideos:`, error);
            }
        }
        else {
            try {
                let videoTitle = videoData[0].title;
                const fileRef = firebase_admin_conf_1.default.file(videoTitle);
                try {
                    const [fileData] = yield fileRef.get();
                    if (fileData) {
                        fileRef.getSignedUrl({ action: 'read', expires: Date.now() + (24 * h) })
                            .then(([url]) => {
                            res.status(200).send({ msg: `CONVERSION SUCCESS (${videoTitle})`, downloadUrl: url, videoTitle });
                        })
                            .catch((err) => {
                            console.error(`zipDownload: Error fetching signed url from fileRef:`, err);
                        });
                    }
                }
                catch (error) {
                    console.log(`fileRef: No such file found in db. Continuing with conversion.`);
                    // console.error(error)
                    const downloadUrl = yield (0, handleVideoConversion_1.downloadVideo)(resourceId, videoTitle);
                    res.status(200).send({ msg: `CONVERSION SUCCESS (${videoTitle})`, downloadUrl, videoTitle });
                }
            }
            catch (err) {
                console.error(`Error:`, err);
            }
        }
    });
}
exports.handleVideoConversion = handleVideoConversion;
// downloadVideo({videoId: 'Qz9UM3v1k9U'}, '(FREE) Young Nudy x Pierre Bourne Type Beat "Call It"')
/*Cool function to download a file from firebase cloud storage*/
/*(() => {
  const fileRef= bucket.file("filename2.mp3")
  fileRef.download({destination: '../filename2.mp3'})
  .then(()=>{
    console.log(`File filename2.mp3 downloaded to project successfully.`)
  })
  .catch((error) => {
    console.error(`Error downloading filename2.mp3: ${error}`);
  });
})()*/
