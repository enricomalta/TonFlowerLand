export default class TonWebMock {
  constructor(){ this.mock = true; }
  wallet = { create: () => ({ mock:true }) };
}