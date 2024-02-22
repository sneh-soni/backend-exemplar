// Higher Order Function ==> takes func as argument

const asyncHandler = (func) => {
  return async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (error) {
      res.status(502).json({
        message: error.message,
        success: false,
      });
    }
    /*
    Alternate for try-catch

    return Promise
    .resolve(func(req, res, next))
    .catch((error)=>{
        next(error)
    })
    */
  };
};

export default asyncHandler;
