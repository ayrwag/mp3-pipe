import express from "express"
import cors from "cors"
import routes from "./routes";

const localhost = true
const app = express()

const cors_options = {
    allowedHeaders: ['Content-Type', 'Accept', 'Content-Disposition', 'X-Filename'], // Add the custom headers here
    exposedHeaders: ['Content-Type', 'Accept', 'Content-Disposition', 'X-Filename'], // Add the custom headers here
  };
  app.use(cors(cors_options));
  app.use(express.json());
  app.use(routes);
  
  app.listen(localhost?3000:8080, () => {
      console.log('Server is running on port '+(localhost?"3000":"8080"));
    });