import bucket, {db} from '../firebase-admin-conf';
import archiver from 'archiver'
import axios from 'axios'
import async from 'async'
import { downloadVideo, getVideoOrPlaylistId } from '../services/handleVideoConversion';
import { parseVideoDataFromUrl } from '../services/handleYouTubeLink';
import { Request } from 'express';


/** the whole Process 
 * get the urls for each video if it's a playlist
 * for each url, download it to firebase cloud storage, as an MP3
    //spawn an ffmpeg instance and a youtube-dl instance
    //stream the youtube's data through ytdl to ffmpeg
    //stream the output to firebase cloud storage
    * res.send a URI for client to access the downlaod.
*/

export const handleYouTubeLink = async (req: Request, res: any) => {
  // code for handling YouTube links
  try {
    const url = req.query.url as string
    if(typeof url !== 'string')throw new Error('url query parameter is malformed or missing')
    
    console.log("handleYouTubeLink: fetching video data from the link.");
    const videoData = await parseVideoDataFromUrl(url);

    console.log("handleYouTubeLink: videoData request successful.");
    console.log("handleYoutubeLink: sending videoData as a response.");

    res.send(videoData);
  } catch (error) {
    console.error(
      "handleYouTubeLink: Error fetching video data from URL.",
      error
    );
  }
};

export async function handleVideoConversion(req:any, res:any){
  let {url} = req.body; //set in request body
  let { videoData } = req.body //set in request body
  if(!url) {videoData = req.body;url=req.body[0].url}
  if(!videoData?.length) throw new Error("ConvertVideo: Request body is malformed or missing")

  const resourceId = await getVideoOrPlaylistId(url)
  const h = 60 * 60 * 1000
  if(resourceId.isPlaylist) {
    try {
      const playlistTitle = await (async () => {
        const apiUrl = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet&id=${resourceId.playlistId}&key=`
        const doc = await db.collection('admin').doc('youtube_data_api_v3').get()
        const {GOOGLE_API_KEY}:any = doc.data()
        const response:any = await axios.get(apiUrl+GOOGLE_API_KEY)
        const {items} = response.data
        console.log(`this is items!!:`, items)
        const {title} = items[0].snippet
        return title
      })()
      const filePath = `playlists/${playlistTitle} (${resourceId.playlistId}).zip`
      const fileRef = bucket.file(filePath)
      try {
        const [fileData] = await fileRef.get()
        if (fileData) {
          fileRef.getSignedUrl(
            {action:'read', expires: Date.now() + (24*h)}
          )
          .then(([url])=>{
            res.status(200).send({msg:`Playlist conversion was a success (${playlistTitle})`, playlistPath:url})
          })
          .catch((err)=>{
            console.error(`zipDownload: Error fetching signed url from fileRef:`, err)
          })
          return
        }
      } catch (err) {
        console.log(`fileRef: No such file found in db. Continuing with conversion.`)
        // console.error(err)
      }
      const output = fileRef.createWriteStream()
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });
      output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
      });
      archive.pipe(output);
      //download videos in a for loop
      async function processVideoData(videoData:any, archive:any) {
        let index = 0;
        const concurrencyLimit = 3; // Adjust as needed
      
        // Create an asynchronous task queue with a concurrency limit
        const taskQueue = async.queue(async (taskData:any, callback) => {
          let {video, index} = taskData
          const idObject = await getVideoOrPlaylistId(video.url);
          await downloadVideo(idObject, video.title, { is: true, index }, archive);
          callback(); // Signal that the task is complete
        }, concurrencyLimit);
      
        // Add tasks to the queue
        videoData.forEach((video:any) => {
          taskQueue.push({video,index}, () => {
            console.log(`Download complete for ${video.title}`);
          });
          index++
        });
      
        // Wait for all tasks in the queue to complete
        await new Promise<void>((resolve) => {
          taskQueue.drain(() => {
            console.log('All videos processed.');
            resolve();
          });
        });
      }

      processVideoData(videoData, archive)
      .then(
        () => {
        archive.finalize()
        if(fileRef){
        fileRef.getSignedUrl(
          {action:'read', expires: Date.now() + (24*h)}
        )
        .then(([url])=>{
          res.status(200).send({msg:`Playlist conversion was a success (${playlistTitle})`, playlistPath:url})
        })
        .catch((err)=>{
          console.error(`zipDownload: Error fetching signed url from fileRef:`, err)
        })
        }
      }
      )
    } catch (error) {
      console.error(`downloadVideos:`, error)
    }
  }
  else {
    try {
      let videoTitle = videoData[0].title
      const fileRef = bucket.file(videoTitle)
      try {
      const [fileData] = await fileRef.get();
      if(fileData){
        fileRef.getSignedUrl(
          {action:'read', expires: Date.now() + (24*h)}
        )
        .then(([url])=>{
        res.status(200).send({msg:`CONVERSION SUCCESS (${videoTitle})`, downloadUrl:url, videoTitle})
        })
        .catch((err)=>{
          console.error(`zipDownload: Error fetching signed url from fileRef:`, err)
        })
      } }catch(error){
      console.log(`fileRef: No such file found in db. Continuing with conversion.`)
      // console.error(error)
      const downloadUrl = await downloadVideo(resourceId, videoTitle)
      res.status(200).send({msg:`CONVERSION SUCCESS (${videoTitle})`, downloadUrl, videoTitle})
      }
    } catch (err) {
      console.error(`Error:`, err);
    }
  }
}


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


