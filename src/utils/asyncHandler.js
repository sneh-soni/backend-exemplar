// Higher Order Function ==> takes func as argument

const asynchandler = (func) => {
  async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (error) {
      res.status(error.code).json({
        message: error.message,
        success: false,
      });
    }
    /*
    Alternate for try-catch

    Promise
    .resolve(func(req, res, next))
    .catch((error)=>{
        next(error)
    })
    */
  };
};

export default asynchandler;
