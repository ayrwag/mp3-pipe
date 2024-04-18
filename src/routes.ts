import express from "express";
import { 
    handleYouTubeLink,
    handleVideoConversion,
} from "./controllers/controllers";

const router = express.Router()

router.get('/',handleYouTubeLink)
router.post('/', handleVideoConversion)

export default router