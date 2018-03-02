//名称:Hexagon空间场js基础库
//版权:武汉大学 资源与环境科学学院 506室
//时间:2017/04/01
//命名规则:1 变量命名遵循camel命名法,如firstFunction   2 全局私有变量命名通过'_'开始,如_firstMember
//作者:倒霉蛋儿
(function (global, lib) {
    'use strict';
    let _version = '2.17.0602';
    //选择器
    //@param [string] 如'#ID'||'.className'||'tagName'
    let _select = function (selector) {
        let t = selector[0],
            name = selector.slice(1, selector.length);
        switch (t) {
            case '#':
                return document.getElementById(name);
                break;
            case '.':
                var nodeList = document.getElementsByClassName(name),
                    eleAry = [];
                for (var i = 0; i < nodeList.length; i++) {
                    eleAry.push(nodeList[i]);
                }
                return eleAry;
                break;
            default:
                return document.getElementsByTagName(selector);
        }
    }

    //------------------------------ 0 基础类 ------------------------------
    let _pointPixel = function (x, y) { return { x: x, y: y, toString: function () { return '(' + this.x + ',' + this.y + ')' } }; }
    let _pointCoord = function (x, z) { return { x: x, z: z, y: -x - z, toString: function () { return '(' + this.x + ',' + this.y + ',' + this.z + ')'; } } }
    let _linePixel = function (pointPixelFrom, pointPixelTo) { return { from: pointPixelFrom, to: pointPixelTo, center: _pointPixel((pointPixelFrom.x + pointPixelTo.x) / 2, (pointPixelFrom.y + pointPixelTo.y) / 2) }; }

    //范围
    //@param [number] 最小x值
    //@param [number] 最大x值
    //@param [number] 最小y值
    //@param [number] 最大y值
    let _extent = function (minX, maxX, minY, maxY) {
        if (arguments.length == 0) {
            this.minX = this.minY = Number.MAX_VALUE;
            this.maxX = this.maxY = -Number.MAX_VALUE;
            return;
        }
        this.minX = minX; this.maxX = maxX;
        this.minY = minY; this.maxY = maxY;
        this.width = maxX - minX;
        this.height = maxY - minY;
        this.center = { x: this.minX + this.width / 2, y: this.minY + this.height / 2 };
    }
    _extent.prototype = {
        //范围比较并更新
        change: function (extent) {
            this.minX = this.minX < extent.minX ? this.minX : extent.minX;
            this.maxX = this.maxX > extent.maxX ? this.maxX : extent.maxX;
            this.minY = this.minY < extent.minY ? this.minY : extent.minY;
            this.maxY = this.maxY > extent.maxY ? this.maxY : extent.maxY;
            this.width = this.maxX - this.minX;
            this.height = this.maxY - this.minY;
            this.center = { x: this.minX + this.width / 2, y: this.minY + this.height / 2 };
        }
    }
    let window2canvas = function (canvas, x, y) {
        let bbox = canvas.getBoundingClientRect();
        return {
            x: x - bbox.left * (canvas.width / bbox.width),
            y: y - bbox.top * (canvas.height / bbox.height)
        };
    }
    //变换矩阵
    let _martix = function () {
        this.matrix = [1, 0, 0, 1, 0, 0];      // normal matrix
        this.inverseMatrix = [1, 0, 0, 1];   // inverse matrix
        this.offset = { x: 0, y: 0 };
        this.scale = 1;
        this.rotate = 0;
    }
    _martix.prototype = {
        createMatrix: function (x, y, scale, rotate) {
            //this.offset.x += x;
            //this.offset.y += y;

            this.offset.x += (x + this.offset.x * (scale - 1));        // modified by yan.
            this.offset.y += (y + this.offset.y * (scale - 1));        // modified by yan.

            this.scale *= scale;
            this.rotate += rotate;

            let m = this.matrix; // just to make it easier to type and read
            let im = this.inverseMatrix; // just to make it easier to type and read
            // create the scale and rotation part of the matrix
            m[3] = m[0] = Math.cos(this.rotate) * this.scale;
            m[2] = -(m[1] = Math.sin(this.rotate) * this.scale);
            // translation
            m[4] = this.offset.x;
            m[5] = this.offset.y;

            // calculate the inverse transformation
            // first get the cross product of x axis and y axis
            let cross = m[0] * m[3] - m[1] * m[2];
            // now get the inverted axies
            im[0] = m[3] / cross;
            im[1] = -m[1] / cross;
            im[2] = -m[2] / cross;
            im[3] = m[0] / cross;
            this.matrix = m;
            this.inverseMatrix = im;
        },
        // function to transform to world space
        toWorld: function (x, y) {
            let xx, yy, m;
            m = this.inverseMatrix;
            xx = x - this.matrix[4];
            yy = y - this.matrix[5];
            return {
                x: xx * m[0] + yy * m[2],
                y: xx * m[1] + yy * m[3]
            }
        }
    }

    let _colorRGBA = function (r, g, b, a) { return 'rgba(' + (r || 0) + ',' + (g || 0) + ',' + (b || 0) + ',' + (a || 1) + ')'; }
    let _colors = { white: 'white', red: 'red', green: 'green', blue: 'blue', gray: 'gray', lightgray: 'lightgray', yellow: 'yellow', lightgreen: 'lightgreen', lightblue: 'ligntblue', black: 'black', purple: 'purple', dodgerblue: 'dodgerblue', forestgreen: 'forestgreen' };
    let _sqrt3 = Math.sqrt(3);

    //异步读取数据
    //parma:method(GET或POST)  url(文件路径或者.aspx文件路径/方法名) dataType:'txt'||'json'  param(json{par1:val1,par2,val2...})
    let _ajax = function (parma, fnSuccess, fnFaild) {
        //1、创建ajax对象
        let oAjax = null;
        if (window.XMLHttpRequest) {
            oAjax = new XMLHttpRequest();
        }
        else {
            oAjax = new ActiveXObject('Miscrosoft.XMLHttpRequest');
        }
        //2、建立连接
        oAjax.open(parma.method, parma.url, true);
        //if (parma.contentType) {
        //    oAjax.setRequestHeader('Content-Type', parma.contentType);
        //}
        //3、发送请求
        oAjax.send(parma.param);
        //4.接收数据
        oAjax.onreadystatechange = function () {
            if (oAjax.readyState == 4) {
                if (oAjax.status == 200) {//完成
                    if (parma.dataType.toLowerCase() == 'json')
                        fnSuccess(JSON.parse(oAjax.responseText));
                    else
                        fnSuccess(oAjax.responseText);
                }
                else {//出错
                    if (fnFaild)
                        fnFaild(oAjax.status);
                }
            }
        };
    }

    //地图
    //@param [string] 容器div标签的id
    //@param [number] 坐标系单位,unit(实际分辨率)
    let _map = function (idName, coordType, unit) {
        let parent = document.getElementById(idName);
        //parent.style.position = 'relative';
        let canvas = document.createElement('canvas');
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        //canvas.style.border = '1px solid lightgray'
        parent.appendChild(canvas);

        window.onresize = (e) => {
            parent = document.getElementById(idName);
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            this.render(true);
        }

        let labelContainer = document.createElement('div');
        labelContainer.style.background = _colorRGBA(250, 250, 250, 0.8);
        labelContainer.style.padding = '5px';
        labelContainer.style.margin = '5px';
        labelContainer.style.borderRadius = '5px';
        labelContainer.style.position = 'absolute';
        labelContainer.style.display = 'none';
        labelContainer.style.top = labelContainer.style.right = '0px';
        let labelState = document.createElement('label');
        labelContainer.appendChild(labelState);

        parent.appendChild(labelContainer);

        //let btnSize = 20;
        //let btnZoomIn = document.createElement('div');
        //btnZoomIn.style.backgroundColor = _colorRGBA(100, 100, 100, 0.5);
        //btnZoomIn.style.position = 'absolute';
        //btnZoomIn.style.top = btnZoomIn.style.left = '0px';
        //btnZoomIn.style.padding = '5px';
        //btnZoomIn.style.margin = '5px';
        //btnZoomIn.style.borderRadius = '5px';
        //btnZoomIn.style.color = 'black';
        //btnZoomIn.style.textAlign = 'center';
        //btnZoomIn.style.lineHeight = btnSize;
        //btnZoomIn.style.width = btnZoomIn.style.height = btnSize + 'px';
        //parent.appendChild(btnZoomIn);


        this.unit = unit;
        //画布
        this.canvas = canvas;
        //绘图上下文
        let context = this.canvas.getContext('2d');
        context.lineWidth = 0.05;
        //context.font = (unit / 20).toFixed(2) + 'px palatino';
        this.labelState = labelState;
        this.showLabelState = false;
        //画笔
        this.graphic = new _graphic(context);
        //坐标系
        this.coordSystem = _coordSystem(coordType, unit);
        //范围
        this.extent = new _extent(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE);
        //this.geometryArray = [];
        this.layerArray = [];
        this.layerCount = 0;
        this.showCoord = false;
        this.firstzRender = true;
        this.updateType = { add: 2, remove: 4, sort: 6, visable: 8 }
        //鼠标事件
        //是否允许缩放平移变换
        this.enableTransform = true;
        //鼠标移动事件
        this.onmousemove = undefined;
        //鼠标点击事件
        this.onmousedown = undefined;
        //鼠标滚轮事件
        this.onmousewhell = undefined;

        //其他事件
        //渲染之后执行事件
        this.afterRender = undefined;

        ////伙伴map 同步操作
        this.partnersAry = [];

        //将map看做一张栅格图片 六边形为栅格像元 
        //记录map最上层的六边形 即呈现的栅格图片的像元
        //优化渲染速度 
        //但是 这会根据图层的增删 层次的变化而改变
        this.image = new Map();//key:pointCoord,value:geoPoint
        this.imageData = new Map();//key:pointCoord,value:2d array
        this.renderTimerId = 0;


        //初始化
        this.inite();
    }
    _map.prototype = {
        //添加图层
        addLayer: function (layer, name) {
            if (!layer) return;

            let self = this;
            layer.name = name || layer.name;
            self.extent.change(layer.extent);
            self.layerArray.push(layer);
            self.layerCount++;

            this.update(this.updateType.add, layer);
        },
        //sortLayer: function () {
        //    this.layerArray.sort((ly1, ly2) => { return ly1.name - ly2.name; });
        //    this.async('sortLayer');
        //},
        //获取图层
        //@param [fnFailed] 图层名字
        getLayer: function (name) {
            return this.layerArray.filter((ly) => { return ly.name == name; })
        },
        removeLayer(name) {
            var layer = this.getLayer(name);
            this.update(this.updateType.remove, layer);

            var index = this.layerArray.indexOf(layer);
            this.layerArray.splice(index, 1);
            this.async('removeLayer', name);
        },
        //清空画布.重新绘制
        render: function (fullExtent) {
            let self = this;
            //清空画布
            self.clear();
            if (self.firstzRender || fullExtent) {
                self.fullExtent();
                self.firstzRender = false;
            }



            //self.sortLayer();
            self.layerArray.forEach(function (ly) {
                if (ly.visable) {
                    //ly.geometryArray.forEach(geometry=> {
                    //    if (geometry) {
                    //        //针对线的补全和面的填充 不包括对点的操作
                    //        switch (geometry.type) {
                    //            case _geoType.geoPoint:
                    //                //self.graphic.fillGeoPoint(geometry);
                    //                self.graphic.fillGeoPoint(geometry);
                    //                break;
                    //            case _geoType.geoPolyline:
                    //                //self.graphic.fillGeoPolyine(geometry);
                    //                self.graphic.fillGeoPolyine(geometry);
                    //                break;
                    //            case _geoType.geoPolygon:
                    //                //self.graphic.fillGeoPolygon(geometry);
                    //                self.graphic.fillGeoPolygon(geometry);
                    //                break;
                    //        }
                    //    }
                    //    else {
                    //        console.log(ly.name);
                    //        console.log(geometry);
                    //    }
                    //})
                    ly.image.forEach(geoPt=> {
                        self.graphic.fillGeoPoint(geoPt);
                    })
                }
            })

            if (self.afterRender)
                self.afterRender();
            this.async('render');
        },
        //初始化Map状态
        inite: function () {
            let self = this;
            self.extent = new _extent();
            self.layerArray = [];
            self.layerCount = 0;
            self.firstzRender = true;
            self.image = new Map();
            self.imageData = new Map();
            if (!self.canvas.onmousewheel) {
                self.canvas.onmousewheel = function (e) {
                    if (!self.enableTransform)
                        return;
                    e.preventDefault();
                    //获取canvas pixelArray
                    var canvasImage = self.graphic.context.getImageData(0, 0, self.canvas.width, self.canvas.height);

                    let scale = e.wheelDelta < 0 ? 0.9 : 1.1;
                    e = window2canvas(self.canvas, e.x, e.y);
                    self.transform(-e.x * (scale - 1), -e.y * (scale - 1), scale, 0);

                    self.clear();
                    self.graphic.context.putImageData(canvasImage, 0, 0);

                    if (self.onmousewhell)
                        self.onmousewhell();
                    clearTimeout(self.renderTimerId);
                    self.renderTimerId = setTimeout(() => {
                        self.render();
                    }, 100);
                }
            }
            if (!self.canvas.onmousemove) {
                self.canvas.onmousemove = function (e) {
                    //self.render();
                    e = window2canvas(self.canvas, e.x, e.y);
                    let wp = self.graphic.canvas2GeoXY(self.canvas, self.graphic.matrix.toWorld(e.x, e.y)),//倒霉蛋儿 2017/10/16
                        hotCoord = self.coordSystem.getHotCoord(_pointPixel(wp.x, wp.y));
                    if (self.showLabelState) {
                        self.labelState.parentElement.style.display = '';
                        let tempPoint = self.getGeoPoint(hotCoord);
                        self.labelState.innerText = "canvas position:x:" + e.x.toFixed(2) + ',y:' + e.y.toFixed(2) +
                            "\nworld position:x:" + wp.x.toFixed(2) + ',y:' + wp.y.toFixed(2);
                        if (hotCoord.z)
                            self.labelState.innerText += '\ncoordSystem:x:' + hotCoord.x + ',z:' + hotCoord.z;
                        else
                            self.labelState.innerText += '\ncoordSystem:x:' + hotCoord.x + ',y:' + hotCoord.y;

                        self.labelState.innerText += '\ngeoXY:X:' + tempPoint.x.toFixed(2) + ',Y:' + tempPoint.y.toFixed(2) + '\n\n';
                    }
                    else {
                        self.labelState.innerText = '';
                        self.labelState.parentElement.style.display = 'none';
                    }
                    if (self.onmousemove)
                        self.onmousemove(hotCoord);
                }
            }
            if (!self.canvas.onmousedown) {
                self.canvas.onmousedown = function (e) {
                    let cp = window2canvas(self.canvas, e.x, e.y);
                    let wp = self.graphic.canvas2GeoXY(self.canvas, self.graphic.matrix.toWorld(cp.x, cp.y)),//倒霉蛋儿 2017/10/16
                     hotCoord = self.coordSystem.getHotCoord(_pointPixel(wp.x, wp.y));

                    if (self.enableTransform && e.button == 1) {
                        let offsetX = 0, offsetY = 0;
                        window.onmousemove = function (ee) {
                            ee.preventDefault();
                            offsetX = ee.clientX - e.clientX;
                            offsetY = ee.clientY - e.clientY;
                        }
                        window.onmouseup = function () {
                            if (offsetX != 0 || offsetY != 0) {
                                self.transform(offsetX, offsetY, 1, 0, true);
                            }
                            //注销 鼠标事件
                            window.onmousemove = null;
                            window.onmouseup = null;
                        }
                    }
                    if (self.onmousedown)
                        self.onmousedown(hotCoord, e);
                }
            }
        },
        //设置单位长度
        setUnit: function (unit) {
            unit = parseFloat(unit.toString());
            this.coordSystem.unit = unit;
            this.graphic.context.font = parseInt(unit / 15) + 'px palatino';

            this.layerArray.forEach((ly) => {
                ly.reInite(this.coordSystem);
            })

            this.async('setUnit', unit);

        },
        //图形变换
        transform: function (tx, ty, scale, rotate, reRender) {
            this.graphic.transform(tx, ty, scale, rotate);
            if (reRender)
                this.render();
            this.async('transform', tx, ty, scale, rotate);
        },
        //清空所有绘制图形
        //@param [bool] 是否删除之前加载的数据
        clear: function (clearData) {
            this.graphic.clear();
            if (clearData)
                this.inite();
            this.async('clear', clearData);
        },
        fullExtent: function () {
            this.graphic.fullExtent(this.extent);//倒霉蛋儿 2017/10/16
            this.async('fullExtent');
        },
        getGeoPoint: function (pointCoord) {
            let self = this;
            let pointPixel = self.coordSystem.getCenterPixel(pointCoord);
            return new _geoPoint(pointPixel.x, pointPixel.y, self.coordSystem);
        },
        //加载ESRI格式的json数据(通过ArcToolBox转Json工具生成的数据)
        //@param [string] 文件路径
        //@param [function]  数据加载成功待执行的方法;方法接收加载的layer和data作参数
        loadEsriJSON: function (url, fnSucceed, fnFailed) {
            let self = this;
            h3.ajax({ method: 'GET', url: url, dataType: 'json' },//1 加载json数据
                   function (d) {
                       let ly = new _layer('layer1'),
                           index = 0;
                       let data = d;//2 加载成功后解析数据
                       data.features.forEach(function (feature) {
                           let geometry;//3 创建地理要素线

                           switch (data.geometryType) {
                               case 'esriGeometryPoint':
                                   geometry = new _geoPoint(feature.geometry.x, feature.geometry.y, self.coordSystem);
                                   break;
                               case 'esriGeometryPolyline':
                                   geometry = new _geoPolyline(self.coordSystem);
                                   feature.geometry.paths.forEach(function (path) {
                                       path.forEach(function (pt) {
                                           geometry.addPoint(pt[0], pt[1]);//4 添加点到线
                                       });
                                   });
                                   break;
                               case 'esriGeometryPolygon':
                                   geometry = new _geoPolygon(self.coordSystem);
                                   feature.geometry.rings.forEach(function (ring) {
                                       ring.forEach(function (pt) {
                                           geometry.addPoint(pt[0], pt[1]);//4 添加点到线
                                       });
                                   });
                                   break;
                           }
                           geometry.properties = feature.attributes;//绑定属性

                           ly.addGeometry(geometry);
                           index++;
                       });
                       //执行绑定的数据加载成功后要执行的方法
                       if (fnSucceed) {
                           fnSucceed(ly, data);
                       }
                       else {
                           self.addLayer(ly);
                           self.render();
                       }
                   },
                function (e) {
                    if (fnFailed) {
                        fnFailed(e);
                    }
                    else {
                        alert('数据加载失败!');
                    }
                });
        },
        //更改格网坐标
        //@param [coordType]  坐标类型,h3.coordType
        //@param [number]  坐标系单位长度
        changeCoordSystem: function (coordType, unit) {
            let self = this;
            unit = unit || self.unit;
            self.coordSystem = new _coordSystem(coordType, unit);
            self.layerArray.forEach(function (ly) {
                ly.reInite(self.coordSystem);
            })
            self.render();
        },
        //导出Esri格式json数据
        //@param [Array] 几何数组(点或线或面,不可混合)
        //return [string] json字符串
        exportEsriJson: function (geoArray) {
            let self = this;
            let oEsriJson = new _esriJson(geoArray);

            let jsonStr = JSON.stringify(oEsriJson);
            let dlg = new h3.alert(jsonStr, '导出EsriJson');
            dlg.show();

            return jsonStr;
        },
        async: function (argunmets) {
            //不含参数
            if (arguments.length == 1) {
                var fnName = arguments[0];
                this.partnersAry.forEach((p) => {
                    p[fnName]();
                })
            }
                //含参数
            else if (arguments.length > 1) {
                var fnName = arguments[0];
                this.partnersAry.forEach((p) => {
                    p[fnName]();
                })
            }
        },
        //地图更新
        //一般图层放生增删操作时使用变化type和变化ly(自动调用)
        //当图层显示状态变化或者图层的几何数据发生变化 不需要参数(手动调用)
        update(type, ly) {
            var self = this;
            if (type && ly && !ly.forceRender) {
                switch (type) {
                    case self.updateType.add:
                        chargeLayerUpadta(chargeLayerAdd, ly);
                        break;
                    case self.updateType.remove:
                        chargeLayerUpadta(chargeLayerRemove, ly);
                        break;
                    case self.updateType.sort:
                        break;
                    case self.updateType.visable:
                        break;
                }
            }
            else if (!type && !ly) {
                this.image = new Map();
                this.layerArray.forEach(ly=> {
                    if (!ly.forceRender)
                        chargeLayerUpadta(chargeLayerAdd, ly);
                })
            }

            function chargeLayerUpadta(chargeFn, ly) {
                ly.geometryArray.forEach(geometry=> {
                    switch (geometry.type) {
                        case _geoType.geoPoint:
                            geometry.vertexArray.forEach(ary=> {
                                ary.forEach(point=> {
                                    point.symbolColor = geometry.symbolColor;
                                    chargeFn(point);
                                })
                            })
                            break;
                        case _geoType.geoPolyline:
                            geometry.pointArray.forEach(function (line) {
                                line.forEach(function (point) {
                                    point.symbolColor = geometry.symbolColor;
                                    chargeFn(point);
                                });
                            });
                            break;
                        case _geoType.geoPolygon:
                            geometry.outerPointArray.forEach(function (line) {
                                line.forEach(function (point) {
                                    point.symbolColor = geometry.innerSymbolColor;
                                    chargeFn(point);
                                });
                            });
                            geometry.innerPointArray.forEach(function (line) {
                                line.forEach(function (point) {
                                    point.symbolColor = geometry.outerSymbolColor;
                                    chargeFn(point);
                                });
                            });
                            break;
                    }
                })
            }

            function chargeLayerAdd(point) {
                if (self.imageData.has(point.pointCoord.toString())) {
                    //如果key已经存在 将point插入数组第一位
                    self.imageData.get(point.pointCoord.toString()).splice(0, 0, point);
                }
                else {
                    //不存在 则初始化 并加入point
                    self.imageData.set(point.pointCoord.toString(), new Array(point));
                }
                self.image.set(point.pointCoord.toString(), point);
            }

            function chargeLayerRemove(point) {
                if (self.imageData.has(point.pointCoord.toString())) {
                    //如果key已经存在 将point插入数组第一位
                    var ary = self.imageData.get(point.pointCoord.toString());
                    var index = ary.indexOf(point);
                    ary.splice(index, 1);
                    if (ary.length > 0)
                        self.image.set(point.pointCoord.toString(), ary[0]);
                    else
                        self.image.delete(point.pointCoord.toString());
                }
            }
            //待完善
            function chargeLayerSort(point) {
                if (self.imageData.has(point.pointCoord)) {
                    //如果key已经存在 将point插入数组第一位
                    self.imageData.get(point.pointCoord).splice(0, 0, point);
                }
                else {
                    //不存在 则初始化 并加入point
                    self.imageData.set(point.pointCoord, new Array(point));
                }
                self.image.set(point.pointCoord, point);
            }
            //待完善
            function chargeLayerVisable(point) {
                if (self.imageData.has(point.pointCoord)) {
                    //如果key已经存在 将point插入数组第一位
                    self.imageData.get(point.pointCoord).splice(0, 0, point);
                }
                else {
                    //不存在 则初始化 并加入point
                    self.imageData.set(point.pointCoord, new Array(point));
                }
                self.image.set(point.pointCoord, point);
            }
        }
    }

    //esri格式的json文件
    //@param [Array] 几何数组(点或线或面,不可混合)
    let _esriJson = function (geoArray) {
        //this.geoArray = geoArray;
        this.create(geoArray);
    }
    _esriJson.prototype = {
        displayFieldName: '',
        fieldAliases: {
            FID: "FID"
        },
        geometryType: "",
        spatialReference: {
            wkid: null
        },
        fields: [
          {
              name: "FID",
              type: "esriFieldTypeOID",//esriFieldTypeInteger  esriFieldTypeString   esriFieldTypeDouble  esriFieldTypeSmallInteger
              alias: "FID"
          }
        ],
        features: [],
        getFeatures: function (geoArray) {
            if (!geoArray || geoArray.length == 0)
                return;
            let feas = [],
                oID = 0;
            geoArray.forEach(function (geo) {
                feas.push({
                    attributes: getAttributes(geo, oID),
                    geometry: getEsriGeometry(geo)
                })
                oID++;
            })
            return feas;

            function getAttributes(geometry, oid) {
                let atr = {};
                for (let pro in geometry.properties) {
                    if (pro == 'FID')
                        atr[pro] = oid;
                    else
                        atr[pro] = geometry.properties[pro];
                }
                return atr;
            }

            //根据几何类型 创建esri geometry  
            function getEsriGeometry(geometry) {
                let esriGeo = {};
                switch (geometry.type) {
                    case _geoType.geoPoint:
                        esriGeo = {
                            x: geometry.x,
                            y: geometry.y
                        }
                        break;
                    case _geoType.geoPolyline:
                        esriGeo = (function () {
                            let paths = [];
                            geometry.vertexArray.forEach(function (ary) {
                                let path = [];
                                ary.forEach(function (pt) {
                                    path.push([pt.pointPixelOrg.x, pt.pointPixelOrg.y]);
                                })
                                paths.push(path);
                            })
                            return { paths: paths };
                        })();
                        break;
                    case _geoType.geoPolygon:
                        esriGeo = (function () {
                            let rings = [];
                            geometry.vertexArray.forEach(function (ary) {
                                let ring = [];
                                ary.forEach(function (pt) {
                                    ring.push([pt.pointPixelOrg.x, pt.pointPixelOrg.y]);
                                })
                                rings.push(ring);
                            })
                            return { rings: rings };
                        })();
                        break;
                }
                return esriGeo;
            }
        },
        create: function (geoArray) {
            let self = this;
            if (!geoArray || geoArray.length == 0)
                return;
            let geometry = geoArray[0];
            //几何类型
            switch (geometry.type) {
                case _geoType.geoPoint:
                    self.geometryType = 'esriGeometryPoint';
                    break;
                case _geoType.geoPolyline:
                    self.geometryType = 'esriGeometryPolyline';
                    break;
                case _geoType.geoPolygon:
                    self.geometryType = 'esriGeometryPolygon';
                    break;
            }
            //遍历属性
            let fieldAliases = {}, fields = [];
            for (let pro in geometry.properties) {
                fieldAliases[pro] = pro;
                if (pro != 'FID') {
                    let property = geometry.properties[pro];
                    switch (typeof (property)) {
                        case 'string':
                            fields.push({
                                name: pro,
                                type: 'esriFieldTypeString',
                                alias: pro
                            })
                            break;
                        case 'number':
                            if (property.toString().split('.').length > 1) {
                                fields.push({
                                    name: pro,
                                    type: 'esriFieldTypeDouble',
                                    alias: pro
                                })
                            }
                            else {
                                fields.push({
                                    name: pro,
                                    type: 'esriFieldTypeInteger',
                                    alias: pro
                                })
                            }
                            break;
                    }
                }
                else {
                    fields.push({
                        name: pro,
                        type: 'esriFieldTypeOID',
                        alias: pro
                    })
                }
            }
            self.fieldAliases = fieldAliases;
            self.fields = fields;
            self.features = self.getFeatures(geoArray);
        }
    }

    //提示框
    //@param [string] 内容
    //@param [string] 标题
    let _myAlert = function (txt, title) {
        var self = this;
        title = title || 'Alert';
        this.alertDlg = `<div class="my-alert">
        <div class="my-alert-con">
            <div class="my-alert-con-title">${title}<span class="my-alert-close" title="关闭">×</span></div>
            <div class="my-alert-con-p">${txt}</div>
        </div>
    </div>`;
        //显示
        this.show = function () {
            _select('body')[0].style.position = 'relative';
            _select('body')[0].innerHTML += this.alertDlg;
            _select('.my-alert-close')[0].addEventListener('click', function () {
                self.hide();
            })
        }
        //隐藏
        this.hide = function () {
            _select('body')[0].removeChild(_select('.my-alert')[0]);
        }
    }

    //图层
    //@param [string] 图层名字
    let _layer = function (name) {
        this.name = name;
        this.extent = new _extent();
        this.geomtryCount = 0;
        this.geometryArray = []
        this.geoDictionary = {};
        this.visable = true;
        this.coordsMap = new Map();
        this.imageData = new Map();
        this.image = new Map();
        this.symbolColor = _colorRGBA(200, 200, 200, 0.5);
    }
    _layer.prototype = {
        //添加几何
        addGeometry: function (geometry, key) {
            let self = this;
            self.extent.change(geometry.extent);
            if (key) {
                geometry.key = key;
                self.geoDictionary[key] = geometry;
            }
            //针对线的补全和面的填充 不包括对点的操作
            switch (geometry.type) {
                case _geoType.geoPoint:
                    geometry.symbolColor = geometry.symbolColor || this.symbolColor;
                    self.geometryArray.push(geometry);

                    //给coordsMap赋值
                    geometry.vertexArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            initCoordsMap(geoPoint);
                        })
                    })
                    break;
                case _geoType.geoPolyline:
                    geometry.symbolColor = this.symbolColor;
                    geometry.create();
                    self.geometryArray.push(geometry);

                    //给coordsMap赋值
                    geometry.pointArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            initCoordsMap(geoPoint);
                        })
                    })
                    break;
                case _geoType.geoPolygon:
                    geometry.innerSymbolColor = geometry.innerSymbolColor || self.innerSymbolColor;
                    geometry.outerSymbolColor = geometry.outerSymbolColor || self.outerSymbolColor;
                    geometry.create();
                    self.geometryArray.push(geometry);

                    //给coordsMap赋值
                    geometry.innerPointArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            initCoordsMap(geoPoint);
                        })
                    })
                    geometry.outerPointArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            initCoordsMap(geoPoint);
                        })
                    })
                    break;
            }
            //self.geometryArray.push(geometry);
            self.geomtryCount++;
            return geometry;

            function initCoordsMap(geoPoint) {
                var key = geoPoint.pointCoord.toString()
                self.coordsMap.set(key, geoPoint.pointCoord);
                self.image.set(key, geoPoint);
                if (!self.imageData.has(key))
                    self.imageData.set(key, []);
                self.imageData.get(key).push(geoPoint);
            }
        },
        //坐标系更改后重新初始化(数不变)
        reInite: function (coordSystem) {
            var geoAry = this.geometryArray;
            this.removeAllGeometry();
            for (var i = 0; i < geoAry.length; i++) {
                var geo = geoAry[i].changeCoordSystem(coordSystem);
                this.addGeometry(geo, geo.key);
            }
        },
        getGeometry: function (key) {
            return this.geoDictionary[key];
        },
        removeGeometry: function (geometry) {
            if (!geometry)
                return;
            let self = this,
                index = 0;
            switch (geometry.type) {
                case _geoType.geoPoint:
                    //删除 coordsMap值
                    geometry.vertexArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            self.coordsMap.delete(geoPoint.pointCoord.toString());
                        })
                    })
                    break;
                case _geoType.geoPolyline:
                    //删除 coordsMap值
                    geometry.pointArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            self.coordsMap.delete(geoPoint.pointCoord.toString());
                        })
                    })
                    break;
                case _geoType.geoPoint:
                    //删除 coordsMap值
                    geometry.innerPointArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            self.coordsMap.delete(geoPoint.pointCoord.toString());
                        })
                    })
                    geometry.outerPointArray.forEach(ary=> {
                        ary.forEach(geoPoint=> {
                            self.coordsMap.delete(geoPoint.pointCoord.toString());
                        })
                    })
                    break;
            }



            index = self.geometryArray.indexOf(geometry);
            self.geometryArray.splice(index, 1);
            self.geomtryCount--;

            if (geometry.key)
                delete self.geoDictionary[geometry.key];

            return geometry;
        },
        removeAllGeometry: function () {
            this.extent = new _extent();
            this.geomtryCount = 0;
            this.geometryArray = [];
            this.geoDictionary = {};
            this.coordsMap = new Map();
            this.imageData = new Map();
            this.image = new Map();
        },
        //如果是点和线只需要一个颜色
        //如果是面 可以一个也可以两个(inner和outer)颜色
        setSymbolColor(color1, color2) {
            this.symbolColor = color1;
            this.geometryArray.forEach(geometry=> {
                switch (geometry.type) {
                    case _geoType.geoPoint:
                        geometry.symbolColor = color1;
                        geometry.vertexArray.forEach(ary=> {
                            ary.forEach(point=> {
                                point.symbolColor = color1;
                            })
                        })
                        break;
                    case _geoType.geoPolyline:
                        geometry.symbolColor = color1;
                        geometry.pointArray.forEach(function (line) {
                            line.forEach(function (point) {
                                point.symbolColor = color1;
                            });
                        });
                        break;
                    case _geoType.geoPolygon:
                        geometry.outerSymbolColor = color1;
                        geometry.innerSymbolColor = color2 || color1;
                        geometry.outerPointArray.forEach(function (line) {
                            line.forEach(function (point) {
                                point.symbolColor = color1;
                            });
                        });
                        geometry.innerPointArray.forEach(function (line) {
                            line.forEach(function (point) {
                                point.symbolColor = color2 || color1;
                            });
                        });
                        break;
                }
            })
        }
    }

    //------------------------------ 1 格网坐标系统;六边形/正方形 ------------------------------
    let _coordType = { hexagon: 0, square: 1 };
    let _coordSystem = function (coordType, unit) {
        let coord = undefined;
        if (coordType) {
            coord = new _squareCoord(_pointPixel(0, 0), unit);
        }
        else {
            coord = new _hexCoord(_pointPixel(0, 0), unit / _sqrt3);
        }
        coord.coordType = coordType || 0;
        return coord;
    }
    let _coord = function () {

    }
    _coord.prototype = {

    }
    //------------------------------ 1.1 三斜轴坐标系x+y+z=0 ------------------------------

    //三斜轴坐标系
    //@param [pointPixel] 坐标原点在画布的位置
    //@param [number] 单位长度
    let _hexCoord = function (pointOrigin, unit) {
        //坐标原点x y
        this.origin = pointOrigin || _pointPixel(0, 0);
        //坐标单位长度,像素值
        this.unit = unit || 20 / _sqrt3;
        //偏移量x y
        this.offset = _pointPixel(0, 0);
    }
    _hexCoord.prototype = {
        toString: function () { return 'Origin:' + this.origin + ';Unit:' + this.unit; },
        //六边形高度
        //@return [number]
        height: function () { return this.unit * Math.sqrt(3); },
        //根据三斜轴坐标计算屏幕坐标
        //@param [pointCoord] 坐标点
        //@return [pointPixel]
        getCenterPixel: function (pointCoord) {
            let y = 3 / 2 * this.unit * pointCoord.z + this.origin.y,
                x = this.origin.x + (pointCoord.x + pointCoord.z / 2) * this.height();
            return _pointPixel(x, y);
        },
        //通过鼠标位置的画布坐标获取coordSystem
        //@param [pointPixel] 画布像素坐标点
        //@return [pointCoord]
        getHotCoord: function (pixelPosition) {
            //根据屏幕坐标 大致计算在哪个格子(结果不是整数)
            //这里的计算就是getCenterPixel的逆过程
            let hexZ = (pixelPosition.y - this.origin.y) / (3 / 2 * this.unit),
                hexX = (pixelPosition.x - this.origin.x) / this.height() - hexZ / 2,
                hexY = -hexX - hexZ;
            //对计算的坐标四舍五入
            let hexXR = Math.round(hexX),
                hexZR = Math.round(hexZ),
                hexYR = Math.round(hexY);
            //计算四舍五入后与之前的结果偏差
            let disX = Math.abs(hexX - hexXR),
                disY = Math.abs(hexY - hexYR),
                disZ = Math.abs(hexZ - hexZR);
            //偏差最大的说明是错误的,而另外两个则是正确的,根据x+y+z=0对错误的值用另外两个表示
            if (disX > disY && disX > disZ) {
                hexXR = -hexYR - hexZR;
            } else if (disY > disZ) {
                hexYR = -hexXR - hexZR;
            } else {
                hexZR = -hexXR - hexYR;
            }
            //最后返回x,z
            return _pointCoord(hexXR, hexZR);
        },
        //矢量转栅格 返回连线坐标点集合
        //@param [point] 起始坐标点
        //@param [point] 结束坐标点
        //@return [Array]
        getRasterLine: function (pointFrom, pointTo) {
            //let coordArray = [];
            //let pointCoordFrom = pointFrom.pointCoord,
            //    pointCoordTo = pointTo.pointCoord,
            //    num = this.getDistance(pointCoordFrom, pointCoordTo);

            ////2017/11/01
            //let oDis = this.getEuDistance(pointFrom, pointTo),
            //    dis = oDis.dis - oDis.disOrg;
            //let pixelFrom = Object.assign({}, pointFrom.pointPixel),
            //    pixelTo = Object.assign({}, pointTo.pointPixel);

            ////if (oDis.kOrg == 0 || Number.isNaN(oDis.kOrg)) {
            ////pixelFrom = Object.assign({}, pointFrom.pointPixelOrg),
            ////pixelTo = Object.assign({}, pointTo.pointPixelOrg);
            ////    if(oDis.k>0)
            ////    if (oDis.disFrom < oDis.disTo) {
            ////        if (dis > 0) {
            ////            pixelFrom.x -= dis * Math.cos(oDis.alphaOrg);
            ////            pixelFrom.y -= dis * Math.sin(oDis.alphaOrg);
            ////        } else {
            ////            pixelFrom.x += dis * Math.cos(oDis.alphaOrg);
            ////            pixelFrom.y += dis * Math.sin(oDis.alphaOrg);
            ////        }
            ////    }
            ////    else {
            ////        if (dis > 0) {
            ////            pixelTo.x += dis * Math.cos(oDis.alphaOrg);
            ////            pixelTo.y += dis * Math.sin(oDis.alphaOrg);
            ////        } else {
            ////            pixelTo.x -= dis * Math.cos(oDis.alphaOrg);
            ////            pixelTo.y -= dis * Math.sin(oDis.alphaOrg);
            ////        }
            ////    }
            ////}
            ////pointFrom.pixel = pixelFrom;
            ////pointTo.pixel = pixelTo;
            ////pixelFrom = this.getCenterPixel(pointCoordFrom),
            ////pixelTo = this.getCenterPixel(pointCoordTo);

            //let disX = (pixelFrom.x - pixelTo.x) / num,
            //    disY = (pixelFrom.y - pixelTo.y) / num;
            //for (let i = 0; i < num + 1; i++) {
            //    let pointCoordNew = this.getHotCoord(_pointPixel(pixelFrom.x - disX * i, pixelFrom.y - disY * i));
            //    coordArray.push(pointCoordNew);
            //}
            //return coordArray;

            let pointCoordFrom = pointFrom.pointCoord,
                pointCoordTo = pointTo.pointCoord,
                pointPixelFrom = pointFrom.pointPixelOrg,
                pointPixelTo = pointTo.pointPixelOrg;

            let coordArray = [];
            let num = this.getDistance(pointCoordFrom, pointCoordTo);
            let coordPixelFrom = this.getCenterPixel(pointCoordFrom),
                coordPixelTo = this.getCenterPixel(pointCoordTo);
            let disX = (coordPixelFrom.x - coordPixelTo.x) / num,
                disY = (coordPixelFrom.y - coordPixelTo.y) / num,
                disXX = (pointPixelFrom.x - pointPixelTo.x) / num,
                disYY = (pointPixelFrom.y - pointPixelTo.y) / num;
            for (let i = 0; i < num + 1; i++) {
                let pointOnCoord = _pointPixel(coordPixelFrom.x - disX * i, coordPixelFrom.y - disY * i),
                    pointOnPixel = _pointPixel(pointPixelFrom.x - disXX * i, pointPixelFrom.y - disYY * i);
                let offset = this.getVectorDistance(pointOnCoord, pointOnPixel);
                let adjustedX = (pointOnPixel.x - pointOnCoord.x) * Math.min(1e-4, this.unit / (4 * offset)) + pointOnCoord.x,
                    adjustedY = (pointOnPixel.y - pointOnCoord.y) * Math.min(1e-4, this.unit / (4 * offset)) + pointOnCoord.y;
                let pointCoordNew = this.getHotCoord(_pointPixel(adjustedX, adjustedY));
                let rel = {
                    coord: pointCoordNew,
                    pixelOrg: _pointPixel(adjustedX, adjustedY),
                    pixel: this.getCenterPixel(pointCoordNew)
                }
                coordArray.push(rel);
            }
            return coordArray;
        },
        //获取两个坐标点之间的矢量距离
        //@param [pixelFrom] 起始坐标点
        //@param [pixelTo] 结束坐标点
        //@param [float]
        getVectorDistance: function (pixelFrom, pixelTo) {
            return Math.sqrt((pixelFrom.x - pixelTo.x) * (pixelFrom.x - pixelTo.x) + (pixelFrom.y - pixelTo.y) * (pixelFrom.y - pixelTo.y));
        },
        //获取两个坐标之间的距离
        //@param [pointCoord] 起始坐标点
        //@param [pointCoord] 结束坐标点
        //@return [number]
        getDistance: function (pointCoordFrom, pointCoordTo) {
            let num = Math.max(Math.abs(pointCoordFrom.x - pointCoordTo.x), Math.abs(pointCoordFrom.z - pointCoordTo.z));
            num = Math.max(num, Math.abs(pointCoordFrom.x - pointCoordTo.x + pointCoordFrom.z - pointCoordTo.z));
            return num;
        },
        //获取两个坐标之间的距离
        //@param [pointCoord] 起始坐标点
        //@param [pointCoord] 结束坐标点
        //@return [number]
        getManhattanDistance: function (pointCoordFrom, pointCoordTo) {
            let num = Math.max(Math.abs(pointCoordFrom.x - pointCoordTo.x), Math.abs(pointCoordFrom.z - pointCoordTo.z));
            num += Math.abs(pointCoordFrom.x - pointCoordTo.x + pointCoordFrom.z - pointCoordTo.z);
            return num;
        },
        //获取两个坐标之间的欧式距离
        //@param [pointCoord] 起始坐标点
        //@param [pointCoord] 结束坐标点
        //@return [number]
        getEuDistance: function (pointFrom, pointTo, isOrign) {
            let disX = pointFrom.pointPixel.x - pointTo.pointPixel.x,
                disY = pointFrom.pointPixel.y - pointTo.pointPixel.y,
                disX1 = pointFrom.pointPixelOrg.x - pointTo.pointPixelOrg.x,
                disY1 = pointFrom.pointPixelOrg.y - pointTo.pointPixelOrg.y,
                disX2 = pointFrom.pointPixel.x - pointFrom.pointPixelOrg.x,
                disY2 = pointFrom.pointPixel.y - pointFrom.pointPixelOrg.y,
                disX3 = pointTo.pointPixel.x - pointTo.pointPixelOrg.x,
                disY3 = pointTo.pointPixel.y - pointTo.pointPixelOrg.y;

            let k = disY / disX,
                kOrg = disY1 / disX1;

            return {
                //中心点连线距离
                dis: Math.sqrt(disX * disX + disY * disY),
                //原始点连线距离
                disOrg: Math.sqrt(disX1 * disX1 + disY1 * disY1),
                //原始点与中心点距离 from
                disFrom: Math.sqrt(disX2 * disX2 + disY2 * disY2),
                //原始点与中心点距离 from
                disTo: Math.sqrt(disX3 * disX3 + disY3 * disY3),
                k: k,
                kOrg: kOrg,
                alpha: Math.atan(k),
                alphaOrg: Math.atan(kOrg)
            }
        },
        //获取某一点的第level层六边形坐标环
        //@param [pointCoord] 中心点坐标
        //@param [number] 指示第几层
        //@return [pointCoord Array]
        getBoundryCoords: function (centerCoord, level) {
            let ary_boundry = [];
            level += 1;
            for (let i = -level + 1; i < level; i++) {
                for (let j = -level + 1; j < level; j++) {
                    if (Math.abs(i + j) == level - 1 || (Math.abs(i + j) < level - 1 && (Math.abs(i) == level - 1 || Math.abs(j) == level - 1))) {
                        ary_boundry.push(_pointCoord(i + centerCoord.x, j + centerCoord.z));
                    }
                }
            }
            return ary_boundry;
        },
        //以某一格网为中心 探测周边层数为level以内的坐标的可视性
        //@param [pointCoord] 中心点坐标
        //@param [number] 指示第几层
        //@param [Map] 存储通行格网点的字典
        //@param [Map] 存储障碍物格网点的字典
        //@return [pointCoord Map]
        getViewCoordsMap: function (centerCoord, level, pasableCoordsMap, obstacleCoordsMap) {
            var self = this;
            let viewCoordsMap = new Map();
            for (var l = 1; l < level + 1; l++) {
                viewCoordsMap.set(l, new Map());
            }
            let ary_boundry = self.getBoundryCoords(centerCoord, level);
            let canSee = true;
            ary_boundry.forEach(function (coord) {
                let pt_from = centerCoord,
                    pt_to = coord;
                let num = self.getDistance(pt_from, pt_to);
                pt_from = self.getCenterPixel(pt_from),
                pt_to = self.getCenterPixel(pt_to);
                let dis_x = (pt_from.x - pt_to.x) / num,
                    dis_y = (pt_from.y - pt_to.y) / num;

                canSee = true;
                for (let i = num - 1; i >= 0 ; i--) {
                    let pt_new = { x: pt_to.x + dis_x * i, y: pt_to.y + dis_y * i };
                    let hex_new_pos = self.getHotCoord(pt_new, true);
                    let key = hex_new_pos.toString();
                    if (canSee && (obstacleCoordsMap && obstacleCoordsMap.has(key) || !pasableCoordsMap.has(key))) {
                        canSee = false;
                        continue;
                    }
                    if (!viewCoordsMap.has(num - i)) {
                        viewCoordsMap.set(num - i, new Map());
                    }
                    if (canSee) {
                        //ary_hex[hex_new_pos.x + '_' + hex_new_pos.z].canSee = true;
                        if (!viewCoordsMap.get(num - i).has(key) && pasableCoordsMap.has(key))
                            viewCoordsMap.get(num - i).set(key, hex_new_pos);
                    }
                }
            });
            return viewCoordsMap;
        },
        //以某一格网为中心 探测周边层数为level以内的坐标的可视性
        //@param [pointCoord] 中心点坐标
        //@param [Map] 存储可通行格网点的字典
        //@param [number] 指示最大检索至第几层格网
        //@return [pointCoord Map]
        getVoronoiCoordsMap: function (centerCoordsMap, coordsMap, maxLevel) {
            var self = this;
            maxLevel = maxLevel || 25;
            centerCoordsMap.forEach(centerCoord => {
                let voronoiCoordsMap = new Map();
                var level = 1,
                    end = false;
                while (level <= maxLevel && !end) {
                    var itemNum = 0;
                    var boundCoords = self.getBoundryCoords(centerCoord, level);

                    boundCoords.forEach(coord=> {
                        if (self.isInView(centerCoord, coord, coordsMap)) {
                            var key = coord.toString();
                            if (coordsMap.has(key)) {
                                var geoPt = coordsMap.get(key);
                                //不存才归属关系 建立
                                //存在归属关系 判断hostLevel>level?删除原有关系重建新关系:什么也不做

                                if (!geoPt.hostLevel || geoPt.hostLevel && geoPt.hostLevel >= level) {
                                    //解除先前归属关系
                                    if (geoPt.host) {
                                        geoPt.host.voronoiCoordsMap.get(geoPt.hostLevel).delete(key);
                                    }

                                    //建立新的归属关系
                                    geoPt.hostLevel = level;
                                    geoPt.host = centerCoord;

                                    if (!voronoiCoordsMap.has(level))
                                        voronoiCoordsMap.set(level, new Map());
                                    voronoiCoordsMap.get(level).set(key, coord);
                                    itemNum++;
                                }
                            }
                        }
                    })
                    if (itemNum == 0)
                        end = true;
                    level++;
                }
                centerCoord.voronoiCoordsMap = voronoiCoordsMap;
            })
        },
        //判断两个格网 是否通视
        isInView: function (fromCoord, toCoord, coordsMap) {
            let pt_from = fromCoord,
                           pt_to = toCoord;
            let num = Math.max(Math.abs(pt_from.x - pt_to.x), Math.abs(pt_from.z - pt_to.z));
            num = Math.max(num, Math.abs(pt_from.x - pt_to.x + pt_from.z - pt_to.z));
            pt_from = this.getCenterPixel(pt_from),
            pt_to = this.getCenterPixel(pt_to);
            let dis_x = (pt_from.x - pt_to.x) / num,
                dis_y = (pt_from.y - pt_to.y) / num;

            var canSee = true;
            for (let i = num - 1; i >= 0 ; i--) {
                let pt_new = { x: pt_to.x + dis_x * i, y: pt_to.y + dis_y * i };
                let hex_new_pos = this.getHotCoord(pt_new, true);
                let key = hex_new_pos.toString();
                if (canSee && !coordsMap.has(key)) {
                    canSee = false;
                    break;
                }
            }
            return canSee;
        },
        //获取邻居索引坐标
        //@param [pointCoord] 坐标点
        //@return [Array]
        getNeiborCoordsWithOrder: function (pointCoord) {
            let x = pointCoord.x,
                z = pointCoord.z;

            let result = new Map();

            var neibors = [_pointCoord(x + 1, z - 1), _pointCoord(x + 1, z), _pointCoord(x, z + 1), _pointCoord(x - 1, z + 1), _pointCoord(x - 1, z), _pointCoord(x, z - 1)];
            for (var i = 0; i < neibors.length; i++) {
                result.set(i + 1, neibors[i]);
            }
            return result;
        },
        //获取邻居索引坐标
        //@param [pointCoord] 坐标点
        //@return [Array]
        getNeiborCoords: function (pointCoord) {
            let x = pointCoord.x,
                z = pointCoord.z;
            return [_pointCoord(x + 1, z), _pointCoord(x + 1, z - 1), _pointCoord(x, z - 1), _pointCoord(x - 1, z), _pointCoord(x - 1, z + 1), _pointCoord(x, z + 1)];
        },
        //创建缓冲区
        //@param [Array] 坐标点(pointCoord)集合
        //@param [number] 缓冲区距离
        //@return [Array]
        createBuffer: function (baseAry, bufferDistance) {
            let dic = {},
                ary = [];
            bufferDistance += 1;

            baseAry.forEach(function (pt) {
                var coord = pt;
                if (pt instanceof _geoPoint) {
                    coord = pt.pointCoord;
                }

                let x = coord.x,
                    z = coord.z;
                //x+1 z | x+1 z-1 | x z-1 | x-1 z | x-1 z+1 | x z+1
                for (let i = -bufferDistance + 1; i < bufferDistance; i++) {
                    for (let j = -bufferDistance + 1; j < bufferDistance; j++) {
                        if (Math.abs(i + j) < bufferDistance)//&& Math.abs(x + i) < level && Math.abs(z + j) < level && Math.abs(x + i + z + j) < level) 
                        {
                            coord = _pointCoord(x + i, z + j);//{ x: x + i, z: z + j };
                            if (!dic[coord.x + '_' + coord.z]) dic[coord.x + '_' + coord.z] = coord;
                        }
                    }
                }
            });
            baseAry.forEach(function (hotHex) { if (dic[hotHex.x + '_' + hotHex.z]) delete dic[hotHex.x + '_' + hotHex.z]; });
            for (let name in dic) { ary.push(dic[name]); }

            return ary;
        },
        //创建外部缓冲区
        //@param [Array] 坐标点(pointCoord)集合
        //@param [number] 缓冲区距离
        //@return [Array]
        createBufferOuter: function (coordArray, bufferDistance) {
            let self = this;
            let ary = this.createBuffer(coordArray, bufferDistance),
            dic = {};
            ary.forEach(function (coord) {
                dic[coord.x + '_' + coord.z] = coord;
            });
            let aryBuffers = [],
             aryBuffersCopy = [];
            let index = 0;
            let finded = false;
            ary.forEach(function (coord) { if (aryBuffersCopy.indexOf(coord) < 0) { next(coord); } });
            //提取缓冲区内外环
            function next(preCoord) {
                if (!aryBuffers[index])
                    aryBuffers[index] = [];
                aryBuffers[index].push(preCoord);
                aryBuffersCopy.push(preCoord);
                let aryNextCoord = [],
                    nextCoord,
                    aryNeibors = self.getNeiborCoords(preCoord);
                for (let i = 0; i < aryNeibors.length; i++) {
                    let coord = aryNeibors[i];
                    if (coord.x == -5 && coord.z == 4)
                        coord = { x: -5, z: 4 };
                    if (dic[coord.x + '_' + coord.z]) {
                        if (aryBuffersCopy.indexOf(dic[coord.x + '_' + coord.z]) >= 0)
                            continue;
                        nextCoord = dic[coord.x + '_' + coord.z];
                        aryNextCoord.push(nextCoord);
                        continue;
                    }
                };
                aryNextCoord.forEach(function (nextCoord) {
                    if (aryBuffersCopy.indexOf(nextCoord) < 0) { finded = true; next(nextCoord); }
                    else { finded = false; }
                });
                if (!finded) index++;
            }
            aryBuffers.sort(function (ary1, ary2) { return ary2.length - ary1.length; });
            if (aryBuffers.length <= 2) {
                return aryBuffers[0];
            }
            else if (aryBuffers.length > 2) {
                let result = [];
                aryBuffers.forEach(function (buffers) {
                    if (!self.checkInner(coordArray, buffers[0])) {
                        result = result.concat(buffers);
                    }
                });
                return result;
            }
        },
        //创建内部缓冲区
        //@param [Array] 坐标点(pointCoord)集合
        //@param [number] 缓冲区距离
        //@return [Array]
        createBufferInner: function (coordArray, bufferDistance) {
            let self = this;
            let ary = this.createBuffer(coordArray, bufferDistance),
            dic = {};
            ary.forEach(function (coord) {
                dic[coord.x + '_' + coord.z] = coord;
            });
            let aryBuffers = [],
            aryBuffersCopy = [];
            let index = 0;
            let finded = false;
            ary.forEach(function (coord) { if (aryBuffersCopy.indexOf(coord) < 0) { next(coord); } });
            //提取缓冲区内外环
            function next(preCoord) {
                if (!aryBuffers[index])
                    aryBuffers[index] = [];
                aryBuffers[index].push(preCoord);
                aryBuffersCopy.push(preCoord);
                let aryNextCoord = [],
                    nextCoord,
                    aryNeibors = self.getNeiborCoords(preCoord)
                for (let i = 0; i < aryNeibors.length; i++) {
                    let coord = aryNeibors[i];
                    if (coord.x == -5 && coord.z == 4)
                        coord = { x: -5, z: 4 };
                    if (dic[coord.x + '_' + coord.z]) {
                        if (aryBuffersCopy.indexOf(dic[coord.x + '_' + coord.z]) >= 0)
                            continue;
                        nextCoord = dic[coord.x + '_' + coord.z];
                        aryNextCoord.push(nextCoord);
                        continue;
                    }
                };
                aryNextCoord.forEach(function (nextCoord) {
                    if (aryBuffersCopy.indexOf(nextCoord) < 0) { finded = true; next(nextCoord); }
                    else { finded = false; }
                });
                if (!finded) index++;
            }
            aryBuffers.sort(function (ary1, ary2) { return ary2.length - ary1.length; });
            if (aryBuffers.length == 2) {
                return aryBuffers[1];
            }
            else if (aryBuffers.length > 2) {
                let result = [];
                aryBuffers.forEach(function (buffers) {
                    if (self.checkInner(coordArray, buffers[0])) {
                        result = result.concat(buffers);
                    }
                    //buffers.forEach(function (coord) {
                    //    if (self.checkInner(coordArray, coord)) {
                    //        result.push(coord);
                    //    }
                    //    //else {
                    //    //    result.push(coord);
                    //    //}
                    //});
                });
                return result;
            }
            else
                new Error('传入数据不是不存在内部缓冲');
        },
        checkInner: function (coordArray, coord) {
            let self = this,
                oddNodes = false,
                vertexAry = self.getVertexArray(coordArray, true),
                target = self.getCenterPixel(coord);

            let start = 0, index = vertexAry.length - 1;
            for (let i = start; i < vertexAry.length; i++) {
                if (vertexAry[i].y < target.y && vertexAry[index].y >= target.y
                || vertexAry[index].y < target.y && vertexAry[i].y >= target.y) {
                    if (vertexAry[i].x + (target.y - vertexAry[i].y) / (vertexAry[index].y - vertexAry[i].y) * (vertexAry[index].x - vertexAry[i].x) < target.x) {
                        oddNodes = !oddNodes;
                    }
                }
                index = i;
            }
            return oddNodes;
        },
        //提取特征点
        getVertexArray: function (coordArray, convert2Pixel) {
            let self = this;
            let preCoord = coordArray[coordArray.length - 1], vertexAry = [];

            for (let i = 0; i < coordArray.length; i++) {
                let cd = coordArray[i];
                if (preCoord && (cd.x == preCoord.x || cd.y == preCoord.y || cd.z == preCoord.z)) {

                } else {
                    if (preCoord) {
                        if (convert2Pixel) {
                            vertexAry.push(self.getCenterPixel(preCoord));
                            if (i > 0)
                                vertexAry.push(self.getCenterPixel(coordArray[i - 1]));
                        }
                        else {
                            vertexAry.push(preCoord);
                            if (i > 0)
                                vertexAry.push(coordArray[i - 1]);
                        }
                    }
                    preCoord = cd;
                }
            };
            return vertexAry;
        }
    }

    //------------------------------ 1.2 直角坐标系 ------------------------------

    //直角坐标系
    //@param [pointPixel] 坐标原点在画布的位置
    //@param [number] 单位长度
    let _squareCoord = function (pointOrigin, unit) {
        //坐标原点x y
        this.origin = pointOrigin || _pointPixel(0, 0);
        //坐标单位长度,像素值
        this.unit = unit || 20;
    }
    _squareCoord.prototype = {
        toString: function () { return 'Origin:' + this.origin + ';Unit:' + this.unit; },
        //根据直角坐标计算屏幕坐标
        //@param [pointPixel] 坐标点
        //@return [pointPixel] 像素坐标位置
        getCenterPixel: function (coord) {
            let y = this.origin.y + (coord.y * 2) / 2 * this.unit,
                x = this.origin.x + (coord.x * 2) / 2 * this.unit;
            return _pointPixel(x, y);
        },
        //通过鼠标位置的画布坐标获取hexCoord
        //@param [pointPixel] 画布像素坐标点
        //@return [coord]
        getHotCoord: function (pixelPosition) {
            //根据屏幕坐标 大致计算在哪个格子(结果不是整数)
            //这里的计算就是getCenterPixel的逆过程
            let y = ((pixelPosition.y - this.origin.y) / this.unit * 2) / 2,
                x = ((pixelPosition.x - this.origin.x) / this.unit * 2) / 2;
            return _pointPixel(Math.round(x), Math.round(y));
        },
        //矢量转栅格 返回连线坐标点集合
        //@param [coord] 起始坐标点
        //@param [coord] 结束坐标点
        //@return [Array]
        getRasterLine: function (pointFrom, pointTo) {
            let coordArray = [];
            let coordFrom = pointFrom.pointCoord,
                coordTo = pointTo.pointCoord;
            let num = this.getDistance(coordFrom, coordTo);
            if (num <= 0)
                return coordArray;
            coordFrom = this.getCenterPixel(coordFrom),
            coordTo = this.getCenterPixel(coordTo);
            let disX = (coordFrom.x - coordTo.x) / num,
                disY = (coordFrom.y - coordTo.y) / num;
            for (let i = 0; i < num + 1; i++) {
                let pointCoordNew = this.getHotCoord(_pointPixel(coordFrom.x - disX * i, coordFrom.y - disY * i));

                let rel = {
                    coord: pointCoordNew,
                    pixelOrg: _pointPixel(coordFrom.x - disX * i, coordFrom.y - disY * i),
                    pixel: this.getCenterPixel(pointCoordNew)
                }
                coordArray.push(rel);
            }
            //let countX = Math.abs(coordFrom.x - coordTo.x),
            //    countY = Math.abs(coordFrom.y - coordTo.y);
            ////
            //if (countX > countY) {

            //} else {

            //}
            return coordArray;
        },
        //获取两个坐标之间的距离
        //@param [coord] 起始坐标点
        //@param [coord] 结束坐标点
        //@return [number]
        getDistance: function (coordFrom, coordTo) {
            //let num = Math.max(Math.abs(coordFrom.x - coordTo.x), Math.abs(coordFrom.y - coordTo.y));
            //num = Math.max(num, Math.abs(coordFrom.x - coordTo.x + coordFrom.y - coordTo.y));
            let disX = coordFrom.x - coordTo.x,
                disY = coordFrom.y - coordTo.y;
            return Math.round(Math.sqrt(disX * disX + disY * disY));
        },
        //获取两个坐标之间的距离
        //@param [coord] 起始坐标点
        //@param [coord] 结束坐标点
        //@return [number]
        getManhattanDistance: function (coordFrom, coordTo) {
            let num = Math.max(Math.abs(coordFrom.x - coordTo.x), Math.abs(coordFrom.y - coordTo.y));
            num += Math.abs(coordFrom.x - coordTo.x + coordFrom.y - coordTo.y);
            return num;
        },
        //获取邻居索引坐标
        //@param [coord] 坐标点
        //@param [coord] 是否八邻域
        //@return [Array]
        getNeiborCoords: function (coord, isEight) {
            let x = coord.x,
                y = coord.y;
            //x+1 y | x+1 y-1 | x y-1 | x-1 y-1 | x-1 y | x-1 y+1 | x y+1 | x+1 y+1
            if (isEight)
                //return [_pointPixel(x + 1, y), _pointPixel(x + 1, y - 1), _pointPixel(x, y - 1), _pointPixel(x - 1, y - 1), _pointPixel(x - 1, y), _pointPixel(x - 1, y + 1), _pointPixel(x, y + 1), _pointPixel(x + 1, y + 1)];
                return [_pointPixel(x + 1, y), _pointPixel(x, y - 1), _pointPixel(x - 1, y), _pointPixel(x, y + 1), _pointPixel(x + 1, y - 1), _pointPixel(x - 1, y - 1), _pointPixel(x - 1, y + 1), _pointPixel(x + 1, y + 1)];
            else
                return [_pointPixel(x + 1, y), _pointPixel(x, y - 1), _pointPixel(x - 1, y), _pointPixel(x, y + 1)];
        },
        //获取某一点的第level层六边形坐标环
        //@param [pointCoord] 中心点坐标
        //@param [number] 指示第几层
        //@return [pointCoord Array]
        getBoundryCoords: function (centerCoord, level) {
            let ary_boundry = [];
            var x = centerCoord.x,
                y = centerCoord.y;
            //上下
            for (var i = x - level; i <= x + level; i++) {
                ary_boundry.push(_pointPixel(i, y + level));
                ary_boundry.push(_pointPixel(i, y - level))
            }
            //左右
            for (var j = y - level + 1; j <= y + level - 1; j++) {
                ary_boundry.push(_pointPixel(x - level, j));
                ary_boundry.push(_pointPixel(x + level, j));
            }
            return ary_boundry;
        },
        //以某一格网为中心 探测周边层数为level以内的坐标的可视性
        //@param [pointCoord] 中心点坐标
        //@param [number] 指示第几层
        //@param [Map] 存储通行格网点的字典
        //@param [Map] 存储障碍物格网点的字典
        //@return [pointCoord Map]
        getViewCoordsMap: function (centerCoord, level, pasableCoordsMap, obstacleCoordsMap) {
            var self = this;
            let viewCoordsMap = new Map();
            for (var l = 0; l < level; l++) {
                viewCoordsMap.set(l, new Map());
            }
            let ary_boundry = self.getBoundryCoords(centerCoord, level);
            let canSee = true;
            ary_boundry.forEach(function (coord) {
                let pt_from = centerCoord,
                    pt_to = coord;
                let num = self.getDistance(pt_from, pt_to);
                pt_from = self.getCenterPixel(pt_from),
                pt_to = self.getCenterPixel(pt_to);
                let dis_x = (pt_from.x - pt_to.x) / num,
                    dis_y = (pt_from.y - pt_to.y) / num;

                canSee = true;
                for (let i = num - 1; i >= 0 ; i--) {
                    let pt_new = { x: pt_to.x + dis_x * i, y: pt_to.y + dis_y * i };
                    let hex_new_pos = self.getHotCoord(pt_new, true);
                    let key = hex_new_pos.toString();
                    if (canSee && (obstacleCoordsMap && obstacleCoordsMap.has(key) || !pasableCoordsMap.has(key))) {
                        canSee = false;
                        continue;
                    }
                    if (!viewCoordsMap.has(i)) {
                        viewCoordsMap.set(i, new Map());
                    }
                    if (canSee) {
                        //ary_hex[hex_new_pos.x + '_' + hex_new_pos.z].canSee = true;
                        if (!viewCoordsMap.get(i).has(key) && pasableCoordsMap.has(key))
                            viewCoordsMap.get(i).set(key, hex_new_pos);
                    }
                }
            });
            return viewCoordsMap;
        },
        //以某一格网为中心 探测周边层数为level以内的坐标的可视性
        //@param [pointCoord] 中心点坐标
        //@param [Map] 存储可通行格网点的字典
        //@param [number] 指示最大检索至第几层格网
        //@return [pointCoord Map]
        getVoronoiCoordsMap: function (centerCoordsMap, coordsMap, maxLevel) {
            var self = this;
            maxLevel = maxLevel || 25;
            centerCoordsMap.forEach(centerCoord => {
                let voronoiCoordsMap = new Map();
                var level = 1,
                    end = false;
                while (level <= maxLevel && !end) {
                    var itemNum = 0;
                    var boundCoords = self.getBoundryCoords(centerCoord, level);

                    boundCoords.forEach(coord=> {
                        if (self.isInView(centerCoord, coord, coordsMap)) {
                            var key = coord.toString();
                            if (coordsMap.has(key)) {
                                var geoPt = coordsMap.get(key);
                                //不存才归属关系 建立
                                //存在归属关系 判断hostLevel>level?删除原有关系重建新关系:什么也不做

                                if (!geoPt.hostLevel || geoPt.hostLevel && geoPt.hostLevel >= level) {
                                    //解除先前归属关系
                                    if (geoPt.host) {
                                        geoPt.host.voronoiCoordsMap.get(geoPt.hostLevel).delete(key);
                                    }

                                    //建立新的归属关系
                                    geoPt.hostLevel = level;
                                    geoPt.host = centerCoord;

                                    if (!voronoiCoordsMap.has(level))
                                        voronoiCoordsMap.set(level, new Map());
                                    voronoiCoordsMap.get(level).set(key, coord);
                                    itemNum++;
                                }
                            }
                        }
                    })
                    if (itemNum == 0)
                        end = true;
                    level++;
                }
                centerCoord.voronoiCoordsMap = voronoiCoordsMap;
            })
        },
        //判断两个格网 是否通视
        isInView: function (fromCoord, toCoord, coordsMap) {
            let pt_from = fromCoord,
                           pt_to = toCoord;
            let num = this.getDistance(pt_from, pt_to);
            pt_from = this.getCenterPixel(pt_from),
            pt_to = this.getCenterPixel(pt_to);
            let dis_x = (pt_from.x - pt_to.x) / num,
                dis_y = (pt_from.y - pt_to.y) / num;

            var canSee = true;
            for (let i = num - 1; i >= 0 ; i--) {
                let pt_new = { x: pt_to.x + dis_x * i, y: pt_to.y + dis_y * i };
                let hex_new_pos = this.getHotCoord(pt_new, true);
                let key = hex_new_pos.toString();
                if (canSee && !coordsMap.has(key)) {
                    canSee = false;
                    break;
                }
            }
            return canSee;
        },
        //创建缓冲区
        //@param [Array] 坐标点(coord)集合
        //@param [number] 缓冲区距离
        //@return [Array] coord array
        createBuffer: function (coordArray, bufferDistance) {
            let dic = {},
                ary = [];
            bufferDistance += 1;
            coordArray.forEach(function (coord) {
                let x = coord.x,
                    y = coord.y;
                //x+1 y | x+1 y-1 | x y-1 | x-1 y | x-1 y+1 | x y+1
                for (let i = -bufferDistance + 1; i < bufferDistance; i++) {
                    for (let j = -bufferDistance + 1; j < bufferDistance; j++) {
                        if (Math.abs(i + j) < bufferDistance)//&& Math.abs(x + i) < level && Math.abs(y + j) < level && Math.abs(x + i + y + j) < level) 
                        {
                            coord = _pointPixel(x + i, y + j);//{ x: x + i, y: y + j };
                            if (!dic[coord.x + '_' + coord.y]) dic[coord.x + '_' + coord.y] = coord;
                        }
                    }
                }
            });
            coordArray.forEach(function (hotHex) { if (dic[hotHex.x + '_' + hotHex.y]) delete dic[hotHex.x + '_' + hotHex.y]; });
            for (let name in dic) { ary.push(dic[name]); }
            return ary;
        },
        //创建外部缓冲区
        //@param [Array] 坐标点(coord)集合
        //@param [number] 缓冲区距离
        //@return [Array]
        createBufferOuter: function (coordArray, bufferDistance) {
            let self = this;
            let ary = this.createBuffer(coordArray, bufferDistance),
                result = [];
            ary.forEach(function (coord) {
                if (!self.checkInner(coordArray, coord)) {
                    result.push(coord);
                }
            })
            return result;
        },
        //创建内部缓冲区
        //@param [Array] 坐标点(coord)集合
        //@param [number] 缓冲区距离
        //@return [Array]
        createBufferInner: function (coordArray, bufferDistance) {
            let self = this;
            let ary = this.createBuffer(coordArray, bufferDistance),
                result = [];
            ary.forEach(function (coord) {
                if (self.checkInner(coordArray, coord)) {
                    result.push(coord);
                }
            })
            return result;
        },
        //same
        checkInner: function (coordArray, coord) {
            let self = this,
                oddNodes = false,
                vertexAry = self.getVertexArray(coordArray, true),
                target = self.getCenterPixel(coord);

            let start = 0, index = vertexAry.length - 1;
            for (let i = start; i < vertexAry.length; i++) {
                if (vertexAry[i].y < target.y && vertexAry[index].y >= target.y
                || vertexAry[index].y < target.y && vertexAry[i].y >= target.y) {
                    if (vertexAry[i].x + (target.y - vertexAry[i].y) / (vertexAry[index].y - vertexAry[i].y) * (vertexAry[index].x - vertexAry[i].x) < target.x) {
                        oddNodes = !oddNodes;
                    }
                }
                index = i;
            }
            return oddNodes;
        },
        //提取特征点 same
        getVertexArray: function (coordArray, convert2Pixel) {
            let self = this;
            let preCoord = coordArray[coordArray.length - 1], vertexAry = [];

            for (let i = 0; i < coordArray.length; i++) {
                let cd = coordArray[i];
                if (preCoord && (cd.x == preCoord.x || cd.y == preCoord.y || cd.y == preCoord.y)) {

                } else {
                    if (preCoord) {
                        if (convert2Pixel) {
                            vertexAry.push(self.getCenterPixel(preCoord));
                            if (i > 0)
                                vertexAry.push(self.getCenterPixel(coordArray[i - 1]));
                        }
                        else {
                            vertexAry.push(preCoord);
                            if (i > 0)
                                vertexAry.push(coordArray[i - 1]);
                        }
                    }
                    preCoord = cd;
                }
            };
            return vertexAry;
        }
    }

    //------------------------------ 2.1 六边形 ------------------------------

    //六边形
    //@param [pointPixel] 六边形中心的画布像素坐标
    //@param [number] 六边形边长,应和coordSystem坐标系unit相等
    let _hexagon = function (positionPixel, sideLength) {
        //六边形 画布像素坐标
        this.position = positionPixel;
        //六边形 边长
        this.sideLength = sideLength;
        let angle = Math.PI / 6,
        hexHeight = Math.sin(angle) * this.sideLength,
        hexRadius = Math.cos(angle) * this.sideLength,
        x = this.position.x, y = this.position.y;

        let pointPixel1 = _pointPixel(x, y - this.sideLength),
            pointPixel2 = _pointPixel(x + hexRadius, y - hexHeight),
            pointPixel3 = _pointPixel(x + hexRadius, y + hexHeight),
            pointPixel4 = _pointPixel(x, y + this.sideLength),
            pointPixel5 = _pointPixel(x - hexRadius, y + hexHeight),
            pointPixel6 = _pointPixel(x - hexRadius, y - hexHeight);
        //六边形点集合
        this.pointArray = [pointPixel1, pointPixel2, pointPixel3, pointPixel4, pointPixel5, pointPixel6];

        let linePixel1 = _linePixel(pointPixel1, pointPixel2),
            linePixel2 = _linePixel(pointPixel2, pointPixel3),
            linePixel3 = _linePixel(pointPixel3, pointPixel4),
            linePixel4 = _linePixel(pointPixel4, pointPixel5),
            linePixel5 = _linePixel(pointPixel5, pointPixel6),
            linePixel6 = _linePixel(pointPixel6, pointPixel1);
        //六边形线集合
        this.lineArray = [linePixel1, linePixel2, linePixel3, linePixel4, linePixel5, linePixel6];
    }
    _hexagon.prototype = {
        //获取多个六边形组成的多变形的外边框
        //@param [Array] 六边形集合
        //@return [Array] linePixel集合
        getBoundryLines: function (hexAry) {
            let boundry = new Array(),
                boundryCopy = new Array();
            hexAry.forEach(function (hex) {
                hex.lineArray.forEach(function (line) {
                    let ary = boundry.filter(function (d) { return getDistance(line.center, d.center) < 2 });
                    if (ary.length == 0) { boundry.push(line); }
                    else {
                        let index = boundry.indexOf(ary[0]);
                        if (index > -1) { boundry.splice(index, 1); }
                    }
                });
            });

            let nums = 0
            lineNums = boundry.length;
            preLine = boundry[0];
            boundryCopy.push(preLine);
            boundry.splice(0, 1);
            while (boundry.length > 0 && nums < lineNums) {
                for (let i = 0; i < boundry.length; i++) {
                    let nextLine = boundry[i];
                    if (getDistance(nextLine.from, preLine.to) < 2) {
                        preLine = nextLine;
                        boundryCopy.push(preLine);
                        break;
                    }
                    else if (getDistance(nextLine.to, preLine.to) < 2) {
                        preLine = nextLine;
                        boundryCopy.push({ from: nextLine.to, to: nextLine.from, center: nextLine.center });
                        break;
                    }
                }
                let index = boundry.indexOf(preLine);
                if (index > -1) { boundry.splice(index, 1); }
                nums++;
            }
            return boundryCopy;
            //获取两点的欧氏距离
            let getDistance = function (pt1, pt2) {
                return Math.sqrt((pt1.x - pt2.x) * (pt1.x - pt2.x) + (pt1.y - pt2.y) * (pt1.y - pt2.y));
            }
        }
    }

    //------------------------------ 2.2 正方形 ------------------------------

    //正方形
    //@param [pointPixel] 正方形中心的画布像素坐标
    //@param [number] 正方形边长,应和squareCoord坐标系unit相等
    let _square = function (positionPixel, sideLength) {
        //正方形 画布像素坐标
        this.position = positionPixel;
        //正方形 边长
        this.sideLength = sideLength;
        let x = this.position.x, y = this.position.y;

        //(pos.x - width / 2, pos.y - height / 2)
        //(pos.x + width / 2, pos.y - height / 2)
        //(pos.x + width / 2, pos.y + height / 2)
        //(pos.x - width / 2, pos.y + height / 2)
        //(pos.x - width / 2, pos.y - height / 2)

        let pointPixel1 = _pointPixel(x - this.sideLength / 2, y - this.sideLength / 2),
            pointPixel2 = _pointPixel(x + this.sideLength / 2, y - this.sideLength / 2),
            pointPixel3 = _pointPixel(x + this.sideLength / 2, y + this.sideLength / 2),
            pointPixel4 = _pointPixel(x - this.sideLength / 2, y + this.sideLength / 2);
        //六边形点集合
        this.pointArray = [pointPixel1, pointPixel2, pointPixel3, pointPixel4];

        let linePixel1 = _linePixel(pointPixel1, pointPixel2),
            linePixel2 = _linePixel(pointPixel2, pointPixel3),
            linePixel3 = _linePixel(pointPixel3, pointPixel4),
            linePixel4 = _linePixel(pointPixel4, pointPixel1);
        //六边形线集合
        this.lineArray = [linePixel1, linePixel2, linePixel3, linePixel4];
    }
    _square.prototype = {
        //获取多个六边形组成的多变形的外边框
        //@param [Array] 六边形集合
        //@return [Array] linePixel集合
        getBoundryLines: function (hexAry) {
            let boundry = new Array(),
                boundryCopy = new Array();
            hexAry.forEach(function (hex) {
                hex.lineArray.forEach(function (line) {
                    let ary = boundry.filter(function (d) { return getDistance(line.center, d.center) < 2 });
                    if (ary.length == 0) { boundry.push(line); }
                    else {
                        let index = boundry.indexOf(ary[0]);
                        if (index > -1) { boundry.splice(index, 1); }
                    }
                });
            });

            let nums = 0
            lineNums = boundry.length;
            preLine = boundry[0];
            boundryCopy.push(preLine);
            boundry.splice(0, 1);
            while (boundry.length > 0 && nums < lineNums) {
                for (let i = 0; i < boundry.length; i++) {
                    let nextLine = boundry[i];
                    if (getDistance(nextLine.from, preLine.to) < 2) {
                        preLine = nextLine;
                        boundryCopy.push(preLine);
                        break;
                    }
                    else if (getDistance(nextLine.to, preLine.to) < 2) {
                        preLine = nextLine;
                        boundryCopy.push({ from: nextLine.to, to: nextLine.from, center: nextLine.center });
                        break;
                    }
                }
                let index = boundry.indexOf(preLine);
                if (index > -1) { boundry.splice(index, 1); }
                nums++;
            }
            return boundryCopy;
            //获取两点的欧氏距离
            let getDistance = function (pt1, pt2) {
                return Math.sqrt((pt1.x - pt2.x) * (pt1.x - pt2.x) + (pt1.y - pt2.y) * (pt1.y - pt2.y));
            }
        }
    }


    //------------------------------ 3 绘图库 ------------------------------

    //绘图库
    //@papram [object] canvas上下文
    let _graphic = function (context) {
        this.context = context;
        //this.context.scale(1, -1);
        this.matrix = new _martix();
        this.zoomScale = 1;
        this.fontSize = 2.5;
    }
    _graphic.prototype = {
        clear: function () {
            this.context.save();
            this.context.setTransform(1, 0, 0, 1, 0, 0);
            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
            this.context.restore();
        },
        //倒霉蛋儿 2017/10/16
        //地理坐标 转 绘图坐标
        geoXY2Canvas: function (point) {
            return {
                x: point.x,
                y: this.context.canvas.height - point.y
            }
        },
        //倒霉蛋儿 2017/10/16
        //绘图坐标 转 地理坐标
        canvas2GeoXY: function (canvas, point) {
            return {
                x: point.x,
                y: canvas.height - point.y
            }
        },
        fullExtent: function (extent) {
            var offest = 60;
            //根据数据范围进行平移和缩放变化
            this.matrix = new _martix();
            let scaleX = (this.context.canvas.width - offest) / extent.width,
                scaleY = (this.context.canvas.height - offest) / extent.height;
            let tx = offest / 2, ty = offest / 2, scale = 0;
            if (scaleX < scaleY) {
                scale = scaleX;
                ty = extent.minY * scale + (this.context.canvas.height - extent.height * scale) / 2 - (this.context.canvas.height - extent.height) * scale;//倒霉蛋儿 2017/10/16
                tx -= extent.minX * scale;
            }
            else {
                scale = scaleY;
                tx = (this.context.canvas.width - extent.width * scale) / 2 - extent.minX * scale;
                ty += extent.minY * scale - (this.context.canvas.height - extent.height) * scale;//倒霉蛋儿 2017/10/16
            }

            this.zoomScale = scale;
            this.transform(tx, ty, scale, 0, true);

            //var offset = 60;
            //let scaleX = (this.context.canvas.width - offset) / extent.width,
            //scaleY = (this.context.canvas.height - offset) / extent.height;
            //let tx = offset / 2, ty = offset / 2, scale = 0;
            //if (scaleX < scaleY) { //
            //    scale = scaleX;
            //    ty += extent.minY * scale + (this.context.canvas.height + extent.height * scale) / 2;
            //    tx -= extent.minX * scale;
            //}
            //else {
            //    scale = scaleY;
            //    tx = (this.context.canvas.width - extent.width * scale) / 2 - extent.minX * scale;
            //    ty += extent.minY * scale + extent.height * scale;
            //}
            //this.zoomScale = scale;
            //this.transform(tx, ty, scale, 0);

        },
        transform: function (tx, ty, scale, rotate) {
            this.matrix.createMatrix(tx, ty, scale, rotate);
            let m = this.matrix.matrix;
            this.context.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        },
        //绘制矩形
        //@param [pointPixel] 矩形中心点像素坐标
        //@param [number] 宽度
        //@param [number] 高度
        //@param [string] 颜色,如'red'||'rgba(100,100,100,0.5)'||colorRGBA||colors
        drawRec: function drawRec(pos, width, height, col) {
            pos = this.geoXY2Canvas(pos);
            if (col) { this.context.save(); this.context.strokeStyle = col; }
            this.context.beginPath();
            this.context.moveTo(pos.x - width / 2, pos.y - height / 2);
            this.context.lineTo(pos.x + width / 2, pos.y - height / 2);
            this.context.lineTo(pos.x + width / 2, pos.y + height / 2);
            this.context.lineTo(pos.x - width / 2, pos.y + height / 2);
            this.context.lineTo(pos.x - width / 2, pos.y - height / 2);
            this.context.stroke();
            this.context.restore();
        },
        //填充矩形
        //@param [pointPixel] 矩形中心点像素坐标
        //@param [number] 宽度
        //@param [number] 高度
        //@param [string] 颜色,如'red'或者'rgba(100,100,100,0.5)'
        fillRec: function drawRec(pos, width, height, col) {
            pos = this.geoXY2Canvas(pos);
            if (col) { this.context.save(); this.context.fillStyle = col; }
            this.context.beginPath();
            this.context.moveTo(pos.x - width / 2, pos.y - height / 2);
            this.context.lineTo(pos.x + width / 2, pos.y - height / 2);
            this.context.lineTo(pos.x + width / 2, pos.y + height / 2);
            this.context.lineTo(pos.x - width / 2, pos.y + height / 2);
            this.context.lineTo(pos.x - width / 2, pos.y - height / 2);
            this.context.fill();
            this.context.restore();
        },
        //绘制文本
        //@param [string] 文本内容
        //@param [pointPixel] 位置,像素坐标
        //@param [string] 颜色,如'red'||'rgba(100,100,100,0.5)'||colorRGBA||colors
        fillText: function (val, pos, col) {
            pos = this.geoXY2Canvas(pos);
            this.context.save();
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';
            this.context.scale(1 / this.zoomScale / this.fontSize, 1 / this.zoomScale / this.fontSize);

            if (col) this.context.fillStyle = col;
            this.context.beginPath();
            this.context.fillText(val, pos.x * this.zoomScale * this.fontSize, pos.y * this.zoomScale * this.fontSize);
            this.context.closePath();
            this.context.restore();
        },
        //绘制圆形
        //@param [pointPixel] 圆心,像素坐标
        //@param [number] 半径
        //@param [string] 颜色,如'red'||'rgba(100,100,100,0.5)'||colorRGBA||colors
        drawCircle: function (position, radius, col) {
            position = this.geoXY2Canvas(position);
            this.context.save();
            if (col) this.context.strokeStyle = col;
            this.context.beginPath();
            this.context.arc(position.x, position.y, radius, 0, Math.PI * 2, true);
            this.context.stroke();
            this.context.restore();
        },
        //填充圆形
        //@param [pointPixel] 圆心,像素坐标
        //@param [number] 半径
        //@param [string] 颜色,如'red'||'rgba(100,100,100,0.5)'||colorRGBA||colors
        fillCircle: function (position, radius, col) {
            position = this.geoXY2Canvas(position);
            this.context.save();
            if (col) this.context.fillStyle = col;
            this.context.beginPath();
            this.context.arc(position.x, position.y, radius, 0, Math.PI * 2, true);
            this.context.fill();
            this.context.restore();
        },
        //绘制多段线
        //@param [Array] 按照顺序的像素坐标(pointPixel)集合
        //@param [string] 颜色,如'red'||'rgba(100,100,100,0.5)'||colorRGBA||colors
        //@param [bool]||[0或1] 是否闭合
        drawLineStrip: function (pointArray, col, isClosed) {
            if (pointArray.length < 1)
                return;
            this.context.save();
            if (col) this.context.strokeStyle = col;
            let pointPre = this.geoXY2Canvas(pointArray[0]),
                pointNext;
            this.context.beginPath();
            this.context.moveTo(pointPre.x, pointPre.y);
            for (let i = 1; i < pointArray.length; i++) {
                pointNext = this.geoXY2Canvas(pointArray[i]);
                this.context.lineTo(pointNext.x, pointNext.y);
                pointPre = pointNext;
            }
            if (isClosed) {
                pointNext = this.geoXY2Canvas(pointArray[0]);
                this.context.lineTo(pointNext.x, pointNext.y);
            }
            this.context.stroke();
            this.context.restore();
        },
        //填充闭合线,即多边形
        //@param [Array] 按照顺序的像素坐标(pointPixel)集合
        //@param [string] 颜色,如'red'||'rgba(100,100,100,0.5)'||colorRGBA||colors
        fillLineStrip: function (pointArray, col) {
            if (pointArray.length < 1)
                return;
            this.context.save();
            if (col) this.context.fillStyle = col;
            let pointPre = this.geoXY2Canvas(pointArray[0]),
                pointNext;
            this.context.beginPath();
            this.context.moveTo(pointPre.x, pointPre.y);
            for (let i = 1; i < pointArray.length; i++) {
                pointNext = this.geoXY2Canvas(pointArray[i]);
                this.context.lineTo(pointNext.x, pointNext.y);
                pointPre = pointNext;
            }
            pointNext = this.geoXY2Canvas(pointArray[0]);
            this.context.lineTo(pointNext.x, pointNext.y);
            this.context.closePath();
            this.context.fill();

            //this.context.fillStyle = 'green';
            //pointPre = pointArray[0],
            //   pointNext;
            //this.context.beginPath();
            //this.context.moveTo(pointPre.x, pointPre.y);
            //for (let i = 1; i < pointArray.length; i++) {
            //    pointNext = pointArray[i];
            //    this.context.lineTo(pointNext.x, pointNext.y);
            //    pointPre = pointNext;
            //}
            //pointNext = pointArray[0];
            //this.context.lineTo(pointNext.x, pointNext.y);
            //this.context.closePath();
            //this.context.fill();

            this.context.restore();
        },
        drawGeoPoint: function (geoPoint, color) {
            let self = this;
            geoPoint.vertexArray.forEach(ary=> {
                ary.forEach(point=> {
                    if (point.geometry) {
                        if (color)
                            self.drawLineStrip(point.geometry.pointArray, color, true);
                        else
                            self.drawLineStrip(point.geometry.pointArray, geoPoint.symbolColor, true);
                        if (geoPoint.showCoord) {
                            self.fillText(point.pointCoord.toString(), point.pointPixel, point.labelSymbol);
                        }
                    }
                })
            });
        },
        fillGeoPoint: function (geoPoint, color) {
            let self = this;
            geoPoint.vertexArray.forEach(ary=> {
                ary.forEach(point=> {
                    if (point.geometry) {
                        if (!color) {
                            self.fillLineStrip(point.geometry.pointArray, geoPoint.symbolColor, true);
                            self.drawLineStrip(point.geometry.pointArray, _colors.white, true);
                            if (geoPoint.showCoord)
                                self.fillText(point.pointCoord.toString(), point.pointPixel, point.labelSymbol);
                            if (geoPoint.showLabel)
                                self.fillText(point.properties[point.labelProp], point.pointPixel, point.labelSymbol);
                        } else {
                            self.fillLineStrip(point.geometry.pointArray, color, true);
                            self.drawLineStrip(point.geometry.pointArray, _colors.white, true);
                        }
                    }
                })
            });
        },
        drawGeoPolyine: function (geoPolyline) {
            let self = this;
            if (geoPolyline.showCoord) {
                self.context.save();
                self.context.textAlign = 'center';
                self.context.textBaseline = 'middle';
            }
            geoPolyline.pointArray.forEach(function (line) {
                line.forEach(function (geoPoint) {
                    geoPoint.showCoord = geoPolyline.showCoord;
                    geoPoint.symbolColor = geoPolyline.symbolColor;
                    geoPoint.labelSymbol = geoPolyline.labelSymbol;
                    self.drawGeoPoint(geoPoint);
                });
            });
            self.context.restore();
        },
        fillGeoPolyine: function (geoPolyline) {
            let self = this;
            if (geoPolyline.showCoord) {
                self.context.save();
                self.context.textAlign = 'center';
                self.context.textBaseline = 'middle';
            }
            geoPolyline.pointArray.forEach(function (line) {
                line.forEach(function (geoPoint) {
                    geoPoint.showCoord = geoPolyline.showCoord;
                    geoPoint.symbolColor = geoPolyline.symbolColor;
                    geoPoint.labelSymbol = geoPolyline.labelSymbol;
                    self.fillGeoPoint(geoPoint);
                });
            });
            self.context.restore();
        },
        drawGeoPolygon: function (geoPolygon) {
            let self = this;
            if (geoPolygon.showCoord) {
                self.context.save();
                self.context.textAlign = 'center';
                self.context.textBaseline = 'middle';
            }
            geoPolygon.outerPointArray.forEach(function (line) {
                line.forEach(function (geoPoint) {
                    if (geoPolygon.outerSymbolColor)
                        geoPoint.symbolColor = geoPolygon.outerSymbolColor;
                    geoPoint.labelSymbol = geoPolygon.labelSymbol;
                    geoPoint.showCoord = geoPolygon.showCoord;
                    self.fillGeoPoint(geoPoint);
                });
            });
            geoPolygon.innerPointArray.forEach(function (line) {
                line.forEach(function (geoPoint) {
                    if (geoPolygon.innerSymbolColor)
                        geoPoint.symbolColor = geoPolygon.innerSymbolColor;
                    geoPoint.labelSymbol = geoPolygon.labelSymbol;
                    geoPoint.showCoord = geoPolygon.showCoord;
                    self.drawGeoPoint(geoPoint);
                });
            });
            self.context.restore();
        },
        fillGeoPolygon: function (geoPolygon) {
            let self = this;
            if (geoPolygon.showCoord) {
                self.context.save();
                self.context.textAlign = 'center';
                self.context.textBaseline = 'middle';
            }
            geoPolygon.outerPointArray.forEach(function (line) {
                line.forEach(function (geoPoint) {
                    if (geoPolygon.outerSymbolColor)
                        geoPoint.symbolColor = geoPolygon.outerSymbolColor;
                    geoPoint.labelSymbol = geoPolygon.labelSymbol;
                    geoPoint.showCoord = geoPolygon.showCoord;
                    self.fillGeoPoint(geoPoint);
                });
            });
            geoPolygon.innerPointArray.forEach(function (line) {
                line.forEach(function (geoPoint) {
                    if (geoPolygon.innerSymbolColor)
                        geoPoint.symbolColor = geoPolygon.innerSymbolColor;
                    geoPoint.labelSymbol = geoPolygon.labelSymbol;
                    geoPoint.showCoord = geoPolygon.showCoord;
                    self.fillGeoPoint(geoPoint);
                });
            });
            self.context.restore();
        }
    }
    //------------------------------ 4 几何结构 ------------------------------

    //几何类型
    let _geoType = { geoPoint: 'point', geoPolyline: 'polyline', geoPolygon: 'polygon' };
    //几何结构
    let _geometry = function () {
        this.id = 0;
        this.key;
        //原始节点(geoPoint)集合(二维数组)
        this.vertexArray = [];
        //所有点(geoPoint)集合(二维数组)
        this.pointArray = [];
        //几何范围
        this.extent = new _extent(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE);
        //点数
        this.pointCount = 0;
        //几何字典,key为:pointCoord坐标
        this.pointDictionary = {};
        //几何类型
        this.type = '';
        //样式:颜色
        this.symbolColor = _colors.lightgray;
        this.labelSymbol = _colors.green;
        this.showCoord = false;
        //属性
        this.properties = {};
        //显示字段
        this.labelProp;
        this.coordSystem = {};
    }
    _geometry.prototype = {
        isMultipart: function () { return this.vertexArray.length <= 1 ? false : true; },
        //添加点
        //@param [number] x坐标
        //@param [number] y坐标
        //@param [number] [optional] 指定多部分的哪一部分,默认为0
        //@return [geoPoint] 返回添加的点
        addPoint: function (x, y, index) {
            let pt;
            index = index || 0;
            this.vertexArray[index] = this.vertexArray[index] || [];
            //if (y)
            //    y = -y;
            switch (this.type) {
                case _geoType.geoPoint:
                    if (x && y)
                        pt = new _geoPoint(x, y, this.coordSystem);
                    else {
                        pt = this;
                        x = this.x, y = this.y;
                    }
                    pt.id = this.pointCount;
                    this.vertexArray[index].push(pt);
                    break;
                case _geoType.geoPolyline:
                case _geoType.geoPolygon:
                    pt = new _geoPoint(x, y, this.coordSystem);
                    pt.id = this.pointCount;
                    this.vertexArray[index].push(pt);
                    break;
            }
            //更新范围
            this.extent.minX = this.extent.minX < x ? this.extent.minX : x;
            this.extent.minY = this.extent.minY < y ? this.extent.minY : y;
            this.extent.maxX = this.extent.maxX > x ? this.extent.maxX : x;
            this.extent.maxY = this.extent.maxY > y ? this.extent.maxY : y;
            this.extent.width = this.extent.maxX - this.extent.minX;
            this.extent.height = this.extent.maxY - this.extent.minY;
            this.pointCount++;
            return pt;
        },
        //接口,不可用
        create: function (coordSystem) { },
        //根据ID获取几何点
        //@param [number] coord
        //@return [number] geoPoint
        getPoint: function (coord) { return this.pointDictionary[coord]; },
        //接口,不可用
        within: function (geometry) { },
        //接口不可用
        contains: function (geometry) { },
        //实例继承验证
        isInstanceOfGeometry: function () { alert(this.type + ' is the instance of geometry?' + (this instanceof _geometry)); },
        //所有点格网坐标数组
        toCoordArray: function () {
            let ary = [];
            switch (this.type) {
                case _geoType.geoPoint:
                    this.vertexArray.forEach(function (line) {
                        let aryPt = [];
                        line.forEach(function (geoPoint) {
                            if (geoPoint.geometry)
                                aryPt.push(geoPoint.pointCoord);
                        });
                        ary.push(aryPt);
                    });
                    break;
                case _geoType.geoPolyline:
                    this.pointArray.forEach(function (line) {
                        let aryPt = [];
                        line.forEach(function (geoPoint) {
                            if (geoPoint.geometry)
                                aryPt.push(geoPoint.pointCoord);
                        });
                        ary.push(aryPt);
                    });
                    break;
                case _geoType.geoPolygon:
                    this.outerPointArray.forEach(function (line) {
                        let aryPt = [];
                        line.forEach(function (geoPoint) {
                            if (geoPoint.geometry)
                                aryPt.push(geoPoint.pointCoord);
                        });
                        ary.push(aryPt);
                    });
                    break;
            }
            return ary;
        },
        //所有点坐标的数组
        //@param [bool] 返回原始点坐标
        toPixelArray: function (org) {
            let ary = [];
            switch (this.type) {
                case _geoType.geoPoint:
                    this.vertexArray.forEach(function (line) {
                        let aryPt = [];
                        line.forEach(function (geoPoint) {
                            if (geoPoint.geometry) {
                                if (org)
                                    aryPt.push(geoPoint.pointPixelOrg);
                                else
                                    aryPt.push(geoPoint.pointPixel);

                            }
                        });
                        ary.push(aryPt);
                    });
                    break;
                case _geoType.geoPolyline:
                    this.pointArray.forEach(function (line) {
                        let aryPt = [];
                        line.forEach(function (geoPoint) {
                            if (geoPoint.geometry) {
                                if (org)
                                    aryPt.push(geoPoint.pointPixelOrg);
                                else
                                    aryPt.push(geoPoint.pointPixel);

                            }
                        });
                        ary.push(aryPt);
                    });
                    break;
                case _geoType.geoPolygon:
                    this.outerPointArray.forEach(function (line) {
                        let aryPt = [];
                        line.forEach(function (geoPoint) {
                            if (geoPoint.geometry) {
                                if (org)
                                    aryPt.push(geoPoint.pointPixelOrg);
                                else
                                    aryPt.push(geoPoint.pointPixel);

                            }
                        });
                        ary.push(aryPt);
                    });
                    break;
            }
            return ary;
        },
        //节点坐标的数组
        //@param [bool] 返回原始点坐标
        toVertexArray: function (org) {
            let ary = [];
            this.vertexArray.forEach(function (line) {
                let aryPt = [];
                line.forEach(function (geoPoint) {
                    if (geoPoint.geometry) {
                        if (org)
                            aryPt.push(geoPoint.pointPixelOrg);
                        else
                            aryPt.push(geoPoint.pointPixel);

                    }
                });
                ary.push(aryPt);
            });
            return ary;
        },
        //更改坐标系统
        changeCoordSystem: function (coordSystem) {
            var self = this;
            switch (self.type) {
                case _geoType.geoPoint:
                    var geoPt = new _geoPoint(self.x, self.y, coordSystem);
                    geoPt.symbolColor = self.symbolColor;
                    geoPt.properties = self.properties;
                    geoPt.key = self.key;
                    self = geoPt;
                    break;
                case _geoType.geoPolyline:
                    var geoPl = new _geoPolyline(coordSystem);
                    geoPl.symbolColor = self.symbolColor;
                    geoPl.properties = self.properties;
                    geoPl.key = self.key;
                    for (let i = 0; i < self.vertexArray.length; i++) {
                        self.vertexArray[i].forEach(function (pt) {
                            geoPl.addPoint(pt.x, pt.y, i);
                        })
                    }
                    geoPl.create();

                    self = geoPl;
                    break;
                case _geoType.geoPolygon:
                    var geoPg = new _geoPolygon(coordSystem);
                    geoPg.innerSymbolColor = self.innerSymbolColor;
                    geoPg.outerSymbolColor = self.outerSymbolColor;
                    geoPg.properties = self.properties;
                    geoPg.key = self.key;
                    for (let i = 0; i < self.vertexArray.length; i++) {
                        self.vertexArray[i].forEach(function (pt) {
                            geoPg.addPoint(pt.x, pt.y, i);
                        })
                    }
                    geoPg.create();

                    self = geoPg;
                    break;
            }
            return self;
        }
    }

    //几何-点
    //@param [number] x坐标
    //@param [number] y坐标
    //@param [coordSystem] map.coordSystem对象
    let _geoPoint = function (x, y, coordSystem) {
        _geometry.call(this);
        //几何类型
        this.type = _geoType.geoPoint;
        //x坐标
        this.x = x;
        //y坐标
        this.y = y;

        this.coordSystem = coordSystem;

        //原始画布坐标
        this.pointPixelOrg = new _pointPixel(this.x, this.y);
        //三斜轴坐标点
        this.pointCoord = coordSystem.getHotCoord(this.pointPixelOrg);
        this.neiborCoords = coordSystem.getNeiborCoords(this.pointCoord, true);
        this.neiborCoordsWithOrder = coordSystem.getNeiborCoordsWithOrder(this.pointCoord, true);
        //中点画布坐标
        this.pointPixel = coordSystem.getCenterPixel(this.pointCoord);
        //几何
        this.geometry = {};
        //六边形
        if (!coordSystem.coordType)
            this.geometry = new _hexagon(this.pointPixel, this.coordSystem.unit);//根号3/2
        else
            this.geometry = new _square(this.pointPixel, this.coordSystem.unit);

        //添加自己到vertexArray
        this.addPoint();
    }
    _geoPoint.prototype = new _geometry();
    _geoPoint.constructor = _geoPoint;
    //判断点是否在其他线或者面内部
    //@param [geometry] 几何对象,geoPolyline||geoPolygon
    //@return [bool] true||false
    _geoPoint.prototype.within = function (geometry) {
        //补充代码
    }

    //几何-线
    let _geoPolyline = function (coordSystem) {
        _geometry.call(this);
        this.type = _geoType.geoPolyline;
        this.coordSystem = coordSystem;
        this.parseClose = false;
        this.symbolColor = _colors.lightgray;
    }
    _geoPolyline.prototype = new _geometry();
    _geoPolyline.constructor = _geoPolyline;
    //创建线
    //@param [coordSystem] 坐标系统
    //@param [extent] 几何范围
    //@param [object] canvas画布
    _geoPolyline.prototype.create = function () {
        let self = this;
        //补充中间点
        let lineAry = [], ptAry = [], existAry = [], index = 0;
        lineAry = [], ptAry = [], existAry = [];
        self.pointDictionary = {};
        this.vertexArray.forEach(function (line) {
            ptAry = [];
            let index = 0, start = 1;
            if (self.parseClose) { index = line.length - 1; start = 0; }
            for (let i = start; i < line.length; i++) {
                let midCoordArray = self.coordSystem.getRasterLine(line[index], line[i]),
                disX = (line[index].x - line[i].x) / midCoordArray.length,
                disY = (line[index].y - line[i].y) / midCoordArray.length;
                line[index].properties = _deepCopy(self.properties);//属性

                if (!self.pointDictionary[line[index].pointCoord]) {
                    self.pointDictionary[line[index].pointCoord] = line[index];
                    ptAry.push(line[index]);
                } else {
                    existAry.push(line[index]);
                }

                for (let j = 1; j < midCoordArray.length - 1; j++) {
                    let pointPixel = midCoordArray[j].pixel;// self.coordSystem.getCenterPixel(midCoordArray[j]);
                    let geoPoint = new _geoPoint(pointPixel.x, pointPixel.y, self.coordSystem);
                    geoPoint.properties = _deepCopy(self.properties);//属性

                    if (!self.pointDictionary[geoPoint.pointCoord]) {
                        self.pointDictionary[geoPoint.pointCoord] = geoPoint;
                        ptAry.push(geoPoint);
                    }
                }
                index = i;
            }

            line[index].properties = _deepCopy(self.properties);//属性
            if (!self.pointDictionary[line[index].pointCoord]) {
                self.pointDictionary[line[index].pointCoord] = line[index];
                ptAry.push(line[index]);
            } else {
                existAry.push(line[index]);
            }
            lineAry.push(ptAry);
        });
        this.pointArray = lineAry;
        return self;
    }
    //判断线是否在面内部
    //@param [geometry] geoPolygon
    //@return [bool] true||false
    _geoPolyline.prototype.within = function (geometry) {
        //补充代码
    }
    //判断线是否包含点
    //@param [geometry] geoPoint
    //@return [bool] true||false
    _geoPolyline.prototype.contains = function (geometry) {
        //补充代码
    }

    //几何-面
    let _geoPolygon = function (coordSystem) {
        _geometry.call(this);
        this.type = _geoType.geoPolygon;
        this.coordSystem = coordSystem;
        this.boundry = new _geoPolyline(this.coordSystem);
        this.innerPointArray = [];
        this.outerPointArray = [];
        this.innerSymbolColor = _colorRGBA(220, 220, 220, 0.6);
        this.outerSymbolColor = this.innerSymbolColor;//_colors.lightgray;
    }
    _geoPolygon.prototype = new _geometry();
    _geoPolygon.constructor = _geoPolygon;
    _geoPolygon.prototype.addPoint = function (x, y, index) {
        index = index || 0;
        this.boundry.addPoint(x, y, index);
        this.extent = this.boundry.extent;
    }
    //创建面
    //@param [coordSystem] 坐标系统
    //@param [extent] 几何范围
    //@param [object] canvas画布
    _geoPolygon.prototype.create = function () {
        let self = this;
        this.boundry.parseClose = true;
        this.boundry.properties = _deepCopy(this.properties);
        this.boundry.create(self.coordSystem);

        this.vertexArray = this.boundry.vertexArray;
        this.outerPointArray = this.boundry.pointArray;
        this.pointDictionary = this.boundry.pointDictionary;
        //填充内部
        let arySeeds = [],
            coordArray = this.toCoordArray();
        for (let i = 0; i < coordArray.length; i++) { arySeeds.push(self.coordSystem.createBufferInner(coordArray[i], 1)); self.innerPointArray[i] = []; }
        let index = 0;
        arySeeds.forEach(function (seeds) {
            if (seeds) {
                seeds.forEach(function (seed) {
                    if (!self.pointDictionary[seed]) {
                        let pointPixel = self.coordSystem.getCenterPixel(seed);
                        let geoPt = new _geoPoint(pointPixel.x, pointPixel.y, self.coordSystem);
                        geoPt.properties = _deepCopy(self.properties);//属性

                        self.innerPointArray[index].push(geoPt);
                        self.pointDictionary[seed] = geoPt;
                    }
                    fill(seed, 0, index);
                });
                index++;
            }
        });
        function fill(pt, num, index) {
            //通过闭包 降低内存消耗
            (function () {
                num++;
                let nextAry = [], neiborsAry;
                neiborsAry = self.coordSystem.getNeiborCoords(pt, false);//正方形四邻域;六边形无限制
                neiborsAry.forEach(function (neibor) {
                    if (!self.pointDictionary[neibor]) {
                        let pointPixel = self.coordSystem.getCenterPixel(neibor);
                        let geoPt = new _geoPoint(pointPixel.x, pointPixel.y, self.coordSystem);
                        geoPt.properties = _deepCopy(self.properties);//属性

                        self.innerPointArray[index].push(geoPt);
                        self.pointDictionary[neibor] = geoPt;
                        nextAry.push(neibor);
                    }
                });
                nextAry.forEach(function (next) {
                    if (num % 500 == 0) {
                        addTask(fill, 1, next, num, index);
                    }
                    else
                        fill(next, num, index);
                });
            })();
        }

        /**
        *添加一个任务，
        *    @param {Function} fun 任务函数名
        *    @param {number} delay 定时时间
        *    @param {object} params 传递到fun中的参数
        */
        function addTask(fun, delay) {
            if (typeof fun == 'function') {
                let argu = Array.prototype.slice.call(arguments, 2);
                let f = (function () {
                    fun.apply(null, argu);
                });
                return window.setTimeout(f, delay);
            }
            return window.setTimeout(fun, delay);
        }
        return self;

    }
    //判断线是否包含点
    //@param [geometry] geoPoint||geoPolyline
    //@return [bool] true||false
    _geoPolyline.prototype.contains = function (geometry) {
        //补充代码
    }
    _geoPolygon.prototype.addPolyline = function (geoPolyline) { }



    //引用类型深拷贝
    var _deepCopy = function (obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    //------------------------------ 赋值 ------------------------------
    lib.version = _version;
    lib.sellect = _select;
    lib.alert = _myAlert;
    lib.map = _map;
    lib.layer = _layer;

    lib.pointPixel = _pointPixel;
    lib.pointCoord = _pointCoord
    lib.linePixel = _linePixel;
    lib.extent = _extent;
    lib.colorRGBA = _colorRGBA;
    lib.colors = _colors;
    lib.sqrt3 = _sqrt3;
    lib.ajax = _ajax;
    lib.matrix = _martix;


    lib.coordSystem = _coordSystem;
    lib.coordType = _coordType;
    lib.hexagon = _hexagon;
    lib.square = _square;
    lib.graphic = _graphic;
    lib.geoType = _geoType;
    lib.geometry = _geometry;
    lib.geoPoint = _geoPoint;
    lib.geoPolyline = _geoPolyline;
    lib.geoPolygon = _geoPolygon;
    lib.esriJson = _esriJson;

    lib.deepCopy = _deepCopy;

})(this, this.h3 = {});