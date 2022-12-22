#!/bin/bash
set -e
export HOMEBREW_NO_AUTO_UPDATE=1 

# check if elastic is already running
if [ -f /tmp/elastic.pid ]; then
    echo "Elasticsearch is already running"
    exit 0
fi

# check if elasticsearch not installed
if [ ! -d /usr/local/share/elasticsearch ]; then
    echo "Elasticsearch is not installed"
    VER=8.5.3
    # do not download if file exists
    if [ ! -f elasticsearch-$VER-darwin-x86_64.tar.gz ]; then
        curl -L -O https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-$VER-darwin-x86_64.tar.gz
    fi
    tar -xf elasticsearch-$VER-darwin-x86_64.tar.gz
    mv elasticsearch-$VER /usr/local/share/elasticsearch
fi

# check if OpenJDK 11 is available
if [ ! -d /Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk ]; then
    echo "OpenJDK 11 is not installed"
    # Download and install OpenJDK 11 for macos via homebrew
    brew tap AdoptOpenJDK/openjdk
    brew install adoptopenjdk11
fi

# create data dir
mkdir -p /usr/local/share/elasticsearch/data/elasticsearch

# disable elasticsearch security
echo "xpack.security.enabled: false" >> /usr/local/share/elasticsearch/config/elasticsearch.yml

echo "Starting Elasticsearch with pid file /tmp/elastic.pid"
/usr/local/share/elasticsearch/bin/elasticsearch -d -p /tmp/elastic.pid

# wait until elastic is running
until curl -s -X GET "localhost:9200/_cat/health?h=status" | grep green > /dev/null; do
    echo "Waiting for Elasticsearch to start..."
    sleep 1
done

# check if elasticsearch is running
if [ -f /tmp/elastic.pid ]; then
    echo "Elasticsearch is running"
    exit 0
else
    echo "Elasticsearch is not running"
    exit 1
fi


