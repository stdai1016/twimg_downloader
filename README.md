# Twimg Downloader

A small userscript for download photos on Twitter easily.

## Installation

For running this userscript, you should have a userscript manager, e.g. [Tampermonkey](https://www.tampermonkey.net/).

To install the userscript, see the [twimg_downloader.user.js](./twimg_downloader.user.js) and open raw URL by click the *Raw* button at the top of the file. The userscript manager will ask if you would like to install it (or add new script in the manager and enter the source).

## Usage

Click *Share* button of tweet with photos, *Download Image* button for download file will be shown on menu.
![share menu](./share_menu.jpg)

## Configuration

You could set file zipping and format of filename in the *Storage* tab of the script.
![storage](./storage.jpg)

|Field| Type |Description                   |
|:---:|:----:|------------------------------|
|~~fmt_g~~|~~string~~|~~Format of name of GIF.~~        |
|fmt_p|string|Format of name of photo.      |
|~~fmt_v~~|~~string~~|~~Format of name of video.~~      |
|fmt_z|string|Format of name of zip file.   |
| zip | bool |Compress files if more then 1.|

### Format of filename

Available placeholders are:

* `{base}` basename of url
* `{tweet}` tweet id
* `{pno}` photo number
* `{user}` the user who post the tweet

## Issues

* (fixed) ~~You would get error file in photo sliding mode (`https://twitter.com/*/status/*/photo/*`) after slide to other photos.~~
* Sometimes media in tweet which is opened in new tab cannot be detected (reload the page can solve it).

## TODO

* Page of configuration
* ~~GIF/Video downloader~~
