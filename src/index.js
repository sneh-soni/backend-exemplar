import connectDB from "./db/db.js";
import "dotenv/config";
import { app } from "./app.js";

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log("Mongodb connection failed: ", error);
  });
