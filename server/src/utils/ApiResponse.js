export class ApiResponse {
  constructor(data, message = "Success") {
    this.success = true;
    this.message = message;
    this.data = data;
  }
}
