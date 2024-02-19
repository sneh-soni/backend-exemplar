class ResponseApi {
  constructor(statusCode, message = "success", data) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.success = statusCode < 400;
  }
}

export default ResponseApi;

/*
100 - 199 : informational responses
200 - 299 : successful responses
300 - 399 : redirectional responses
400 - 499 : client error responses
500 - 599 : server error responses
*/
