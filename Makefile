all: build

.PHONY: clean/ui
clean/ui:
	@-(cd ./ui && rm -rf ./build)

.PHONY: clean/lib
clean/lib:
	@-rm -rf ./target

.PHONY: clean/vst
clean/vst:
	@-rm InTune.vst

.PHONY: clean
clean: clean/ui clean/lib clean/vst

.PHONY: build/ui
build/ui:
	@echo "building ui..."
	@(cd ./ui && yarn build)

.PHONY: build/lib
build/lib:
	@echo "building lib..."
	@cargo build --release

.PHONY: build/vst
build/vst:
	@echo "creating vst..."
	@./osx_vst_bundler.sh InTune target/release/libintune.dylib

.PHONY: build
build: clean build/ui build/lib build/vst
	@echo "done!"