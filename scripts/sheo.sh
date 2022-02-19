#!/usr/bin/env bash

set -e

export $(cat .env | xargs)
npm run sheo
