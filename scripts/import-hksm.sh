#!/usr/bin/env bash

set -e

SOURCE_DIR="../hk-split-maker/dist"
TARGET_DIR="src/hk-split-maker-dist"

rm -rf "$TARGET_DIR"
cp -r "$SOURCE_DIR" "$TARGET_DIR"
