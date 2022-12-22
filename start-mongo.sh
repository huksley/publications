#!/bin/bash
export HOMEBREW_NO_AUTO_UPDATE=1 

# check if mongodb is already running
if [ -a /tmp/mongodb-27017.sock ]; then
    echo "MongoDB is already running"
    exit 0
fi

# check if mongo installed
if [ ! -f /usr/local/bin/mongod ]; then
    echo "MongoDB is not installed"
    # Download and install MongoDB for macos via brew
    brew tap mongodb/brew
    # add flag to skip upgrading
   brew install mongodb/brew/mongodb-community
fi

# start mongodb
mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb/mongo.log --fork

# check if mongodb is running
if [ -f /tmp/mongodb-27017.sock ]; then
    echo "MongoDB is running"
    exit 0
else
    echo "MongoDB is not running"
    exit 1
fi



