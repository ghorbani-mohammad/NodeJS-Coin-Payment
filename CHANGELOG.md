## 1.1.0 (2025-09-20)


### Features

* add debug endpoint for invoice retrieval and enhance logging in PayID19Service ([cf89342](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/cf89342d16c71e0adf7bf14e97aeb4b36880b211))
* add invoice status checking and refresh functionality to payment routes ([9585ea5](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/9585ea593611661c3ba909308e71f345fe3727fe))
* add new payment status check endpoints and enhance PayID19Service with detailed status handling ([9590e6a](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/9590e6a4bd07f1f09b28829e3f92afaf854dfed3))
* add optional URL parameters for invoice creation and enhance validation ([a26bb0a](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/a26bb0aedd6d469f074db225c30f4da4487c5242))
* enhance Content Security Policy implementation by generating nonce in middleware for payment success and cancel pages ([05a6ff2](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/05a6ff2a8e3c169a4a72b21ac7d651febd374f94))
* enhance payment status checking with detailed logging and fallback handling for invoice retrieval ([2c6a028](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/2c6a028ddc62fb46d436fe3e4720e6eb40d98f17))
* enhance payment success and cancel pages with automatic redirection and customizable return URLs ([905f927](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/905f9277c84278a924f7baeb511a1730b1d08595))
* enhance payment success and cancel routes with invoice fetching logic for improved user experience ([8e3d5e6](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/8e3d5e6f18215a14b2ff3884554969e6ec88533e))
* implement Content Security Policy for payment success and cancel pages with nonce-based script handling ([f033f5e](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/f033f5e63459772d9370154de355d82488a40266))
* improve Content Security Policy middleware by consolidating nonce generation and dynamic configuration ([30ff418](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/30ff4188fe794126c556311904a8db14894709e8))
* init project with PayID19 ([4c2de8f](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/4c2de8fa34ccf8beb52d0a0afa2cf0f3013c97a5))


### Bug Fixes

* enhance webhook callback validation by ensuring invoice_id is derived from id if missing ([b2a8f01](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/b2a8f01c39645fd5d289375c03d2452f91d0061b))
* simplify URL configuration logic for success and cancel URLs ([7f9bed1](https://github.com/ghorbani-mohammad/NodeJS-Coin-Payment/commit/7f9bed1bba28942a432ba563b1d2252ca4fe9e2b))

