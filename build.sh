rm -rf build
mkdir build

cd rbschange
tar --exclude .svn -czf ../build/rbschange.tgz install.rdf chrome.manifest chrome components defaults
mkdir ../build/rbschange
cd ../build/rbschange
tar -xzf ../rbschange.tgz
zip -r ../rbschange.zip install.rdf chrome.manifest chrome components defaults
cd ../..
rm -rf build/rbschange build/rbschange.tgz

mv build/rbschange.zip build/rbschange1.23.xpi
sha1sum build/rbschange1.23.xpi > build/rbschange1.23.sha1.txt
cat build/rbschange1.23.sha1.txt