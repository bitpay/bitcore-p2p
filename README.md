bitcore-scaffolding
=======

bitcore-scaffolding is an empty repo with placeholders for future modules that extend the functionality of `bitcore`.

See [the main bitcore repo](https://github.com/bitpay/bitcore) for more information.

## Overview

`bitcore` 0.9 will extend functionality through multiple repositories. This repo sets up a basic boilerplate structure.

Remember to change:

* This README.md file
* `bower.json`
* `package.json`
* `index.js`
* Add your code in the `lib` folder
* Your tests should be runnable through `npm test`. By default, the included `package.json` links to `gulp test`, which runs all the files in the `test` folder with both `mocha` and `karma`.
* Edit gulpfile.js appropriately (in particular, the built files).
* Run `npm shrinkwrap` to freeze the dependencies.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
