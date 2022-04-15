/*
 Copyright (c) 2014, Intel Corporation

 Redistribution and use in source and binary forms, with or without modification,
 are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation
 and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        dirs: {
            eslint: 'buildscripts/eslint',
            jsfiles: ['*.js',
                      'admin/*.js',
                      'bin/*.js',
                      'data/*.js',
                      'examples/*.js',
                      'lib/**/*.js',
                      'listeners/**/*.js'
            ],
        },
        eslint: {
            local: {
                src: ['<%= dirs.jsfiles %>'],
                options: {
                    overrideConfigFile: '<%= dirs.eslint %>/config.json',
                }
            }
        },
        nyc_mocha: {
            target: {
                src: "test/*.js",
                options: {
                    nyc: {
                        coverage: {
                            dir: 'dist/coverage',
                            reporter: ['lcov', 'text-summary'],
                            include: ['admin/**', 'lib/**', 'listeners/**'],
                            recursive: true,
                            tempDir: 'dist/temp',
                            all: true
                        }
                    },
                    mocha: {
                        color: true
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-nyc-mocha');

    // Default task(s).
    grunt.registerTask('default', ['eslint:local', 'nyc_mocha:target']);
}
