import bucket from '../firebase-admin-conf'
import {spawn} from 'child_process'
import Ffmpeg from "fluent-ffmpeg-7"
import * as stream from 'stream'


const {PassThrough} = stream
export async function downloadVideo(
    idObject:any, videoTitle:string, 
    more:any = {is:null}, archive:any = null){
    let url
    try{
      url = `https://youtube.com/watch?v=${idObject.videoId}`
      // console.log("downloadVideo: This is the url:", url);
      const options = [
        url,
        "bestaudio/best", // Specify the format you want to download (best audio in this case)
        "--output",
        "-" // Output to stdout
      ];
      let fileRef:any
      let outStream:any
      
      if(!more.is) {
        fileRef = bucket.file(`${videoTitle}.mp3`);
        outStream = fileRef.createWriteStream(); //for some reason when adding contentType metadata, it bugs out lol
      }
      else {
        outStream = new PassThrough()
        function onDataDrained() {
          console.log(`Data has been drained (${more.index+1})`);
          outStream.removeListener('end', onDataDrained);
        }
        if(archive)
        archive.append(outStream,{name: `${more.index+1} ${videoTitle}.mp3`})
        else {
          throw new Error(`downloadVideo: playlists must be passed an archive object!`)
        }
        outStream.on('end', onDataDrained);
        archive.on('warning', function(err:any) {
          if (err.code === 'ENOENT') {
            console.log('warning:',err)
          } else {
            // throw error
            throw err;
          }
        });
        archive.on('error', function(err:Error) {
          throw err;
        });
      }
  
  
    return new Promise<void | string>((resolve, reject)=>{
        try {
          const ytdlProcess:any = spawn('yt-dlp', options);
          const passThroughStream = new PassThrough()
            ytdlProcess.stdout.pipe(passThroughStream);
              /* eslint-disable new-cap */
              ytdlProcess.on("spawn", function() {
                console.log("ytdlprocess started! for video", videoTitle);
              });
  
              Ffmpeg(passThroughStream)
                .noVideo()
                .audioCodec("libmp3lame")
                .format('mp3')
                .on("start", function(commandLine) {
                  console.log("Spawned Ffmpeg with command: " + commandLine);
                })
                .on("error", function error(err) {
                  console.error("ffmpeg - An error has occurred:", err.message);
                  // Handle the error here, you might want to close the outStream and take appropriate actions.
                  outStream.end();
                  reject(new Error("ffmpeg: Operation failed"));
                })
                .output(outStream, {end: true})
                .on("end", function() {
                  console.log("ffmpeg: Processing finished.");
                  // Close the outStream here if you haven't already.
                  outStream.end();
                }).run();
  
            ytdlProcess.on("error", (err: Error) => {
              console.error("youtube-dl process error:", err.message);
              // Close the outStream on error
              // outStream.end();
              reject(new Error("youtube-dl process error"));
            });
    
            ytdlProcess.on("close", (code: number) => {
                console.log(`ytdlProcess: youtube-dl process finished successfully.(exit code ${code})`);
                // outStream.end();
            });
        } catch (error) {
          console.error(error);
          // Handle the error here, you might want to close the outStream and take appropriate actions.
          outStream.end();
          reject(new Error("downloadVideo: try-block failed"));
        }
        outStream.on('close', ()=>{
          if(!more.is && fileRef){
            const h = 60 * 60 * 1000
            console.log(`outStream: closed, fetching url...`)
            fileRef.getSignedUrl(
                {action:'read', expires: Date.now() + (24*h)}
            )
            .then((res:any)=>{
              const [url] = res
              resolve(url)
            });
          } else resolve()
        })
      });
    } catch(err){
      console.error(`downloadVideo, No videoId property in idObject argument. Url is unsettable`)
    }
  }

export async function getVideoOrPlaylistId(url:string){
    let isPlaylist
    if (url.includes('?list=')) isPlaylist = true
    else isPlaylist = false
    if(isPlaylist){
      console.log("It's a playlist.. Hehe, no code for that yet!")
      const playlistId = url.split('list=')[1].split('&')[0]
      return {isPlaylist, playlistId}
    } else {
      let videoId = null
      if(url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].replace(/\?.*/, '')
      else if(url.includes('/shorts/')) videoId = url.split('/shorts/')[1].split('?')[0].split('&')[0]
      else videoId = url.split('/watch?v=')[1].split('&')[0]
      return {isPlaylist, videoId}
    }
  }

