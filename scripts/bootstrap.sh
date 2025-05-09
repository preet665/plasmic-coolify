#!/bin/bash -eux

export PREPARE_NO_BUILD=true

yarn install

# Some packages require running `yarn install` on their directory to
# build successfully.
for package in packages/loader-angular packages/react-web-runtime platform/host-test; do
  pushd $package
  yarn install
  popd
done

nx run-many --target=build
echo "Running make for platform/wab to generate parser files..." 
(cd platform/wab && make)                                     
echo "Finished running make for platform/wab."                 
