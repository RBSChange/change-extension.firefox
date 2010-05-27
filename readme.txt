C:\extensions\mccoy-0.5.en-US.win32\mccoy\mccoy.exe
key :[rbschange]
pwd :[az-"-gFI g4/946]

su - synchronizer
synctotorbs

rsync /home/inthause/extension/bin/rbschange.xhtml rbschange@repos.rbschange.fr:change/instances/rbschange.fr/static/extension/rbschange.xhtml
rsync /home/inthause/extension/bin/rbschange1.23.xpi rbschange@repos.rbschange.fr:change/instances/rbschange.fr/static/extension/rbschange1.23.xpi

rsync /home/inthause/extension/bin/update.rdf  rbschange@repos.rbschange.fr:change/instances/rbschange.fr/static/extension/update.rdf

ssh rbschange@repos.rbschange.fr
cd change/instances/rbschange.fr/static/extension
ln -sfn rbschange1.23.xpi rbschange.xpi