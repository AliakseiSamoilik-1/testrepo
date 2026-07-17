@echo off
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
java -classpath "gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain assembleDebug
