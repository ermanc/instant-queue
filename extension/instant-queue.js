$(function() {
  var LIST_STORAGE = "IQY-VideoList";
  var CONTROL_STATE = "IQY-ControlState";
  var CURRENT_VIDEO = "IQY-CurrentVideo";

  function randId()
  {
    var rid = "";
    var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
      rid += possible.charAt(Math.floor(Math.random() * possible.length));

    return rid;
  }

  function createMainSkeleton() {
    $(document.body).append(
      $("<div>").attr("id", "iqy-main")
        .append(
          $("<div>").attr("id", "iqy-handle").html("IQ")
        )
        .append(
          $("<div>").attr("id", "iqy-videos")
            .append($("<div>").attr("id", "iqy-controls"))
            .append($("<div>").attr("id", "iqy-placeholder")
              .html(
                "<img src='"+chrome.extension.getURL("images/demo.gif")+"' />"+
                "<h4>Start adding videos by dragging them over here!</h4>"
              )
            )
        )
        .on("mouseenter", showDrawer)
        .on("mouseleave", hideDrawer)
    );
  }

  function getControlState() {
    return sessionStorage.getItem(CONTROL_STATE) || "hold";
  }

  function setControlState(state) {
    sessionStorage.setItem(CONTROL_STATE, state);
  }

  function getCurrentVideo() {
    return sessionStorage.getItem(CURRENT_VIDEO) || "";
  }

  function setCurrentVideo(vid) {
    sessionStorage.setItem(CURRENT_VIDEO, vid);
  }

  function startPlaying() {
    setControlState("force-play");
    createControls();
  }

  function stopPlaying() {
    setControlState("hold");
    createControls();
  }

  function goToVideo(id) {
    window.location.href = "//www.youtube.com/watch?v=" + id;
  }

  function getPlayingVideoId() {
    var match = window.location.href.match(/watch\?v=([^&]+)/);

    return (match && match[1]) || null;
  }

  function checkVideoStatus() {
    // console.log("IQ: checking video status...");

    var videos = loadList();
    var currVid = getCurrentVideo();
    var nextVid = null;
    var activeVidId = getPlayingVideoId();

    var currIndex = _.indexOf(_.pluck(videos, "iqid"), currVid);

    if ($("div#feed").length > 0 && getControlState() === "play") {
      // we're on youtube home, and not explicitly playing...
      console.log("IQ: youtube home. not playing...");
      setControlState("hold");
      createControls();
    } else if (getControlState() === "play" && currIndex !== -1 && activeVidId !== videos[currIndex].data.id) {
      console.log("IQ: went to a different video. pausing auto-play!");
      setControlState("hold");
      createControls();
    } else if (videos.length > 0 && getControlState() !== "hold") {
      var nextIndex = currIndex + 1;
      if (nextIndex < videos.length) {
        nextVid = videos[nextIndex];
      }

      if (getControlState() === "force-play" && currIndex >= 0 && activeVidId !== videos[currIndex].data.id) {
        console.log("IQ: going to current video!");
        console.log("IQ: playing: " + videos[currIndex].data.id);
        setControlState("play");
        goToVideo(videos[currIndex].data.id);
      } else if (getControlState() === "force-play" && currIndex < 0 && nextVid) {
        console.log("IQ: starting auto-play!");
        console.log("IQ: playing: " + nextVid.data.id);
        setCurrentVideo(nextVid.iqid);
        setControlState("play");
        goToVideo(nextVid.data.id);
      } else if ($("div#movie_player .ytp-button-replay").length > 0) {
        if (nextVid) {
          console.log("IQ: video is finished!");
          console.log("IQ: playing next: " + nextVid.data.id);
          setCurrentVideo(nextVid.iqid);
          setControlState("play");
          goToVideo(nextVid.data.id);
        } else if (nextIndex >= videos.length) {
          console.log("IQ: list completed.");
          stopPlaying();
          setCurrentVideo("");
          populateVideoList();
        }
      }
    }
    setTimeout(checkVideoStatus, 1000);
  }

  function createControlButton(controlBox) {
    var state = getControlState();
    var playState = state === "play" || state === "force-play";

    controlBox.append($("<a>")
      .attr("id", "iqy-btn-playall")
      .attr("class", "yt-uix-button yt-uix-button-default yt-uix-button-size-default")
      .append($("<img id='iqy-btnicon'>")
        .attr("src", chrome.extension.getURL("images/" + (playState ? "stop.png" : "play.png")))
      )
      .append($("<span>").html(playState ? "Stop auto play" : "Play all"))
      .on("click", function() {
        if (playState)
          stopPlaying();
        else
          startPlaying();
      })
    );
  }

  function createNextButton(controlBox) {
    var videos = loadList();
    var currIndex = _.indexOf(_.pluck(videos, "iqid"), getCurrentVideo());

    if (currIndex < 0 || currIndex >= videos.length - 1) return; // nothing next.

    controlBox.append($("<a>")
      .attr("id", "iqy-btn-nextvid")
      .attr("class", "yt-uix-button yt-uix-button-default yt-uix-button-size-default")
      .append($("<img id='iqy-btnicon'>")
        .attr("src", chrome.extension.getURL("images/next.png"))
      )
      .append($("<span>").html("Next video"))
      .on("click", function() {
        var videos = loadList();
        var currIndex = _.indexOf(_.pluck(videos, "iqid"), getCurrentVideo());

        if (currIndex < 0 || currIndex >= videos.length - 1) return; // nothing next.

        $(this).html("Coming up...");
        setControlState("force-play");
        setCurrentVideo(videos[currIndex + 1].iqid);
      })
    );
  }

  function exportVideosAsPlaylist() {
    var videos = loadList();
    $("#iqy-btn-export span").html("Saving...");

    $.post("playlist_ajax?action_create_playlist=1", {
        video_ids: _.map(videos, function(video) { return video.data.id; }).join(","),
        source_playlist_id: "",
        n: "InstantQueue - " + randId(),
        p: "unlisted",
        session_token: $("input[name='session_token']").val()
      }).done(function(data) {
        $("#iqy-btn-export span").html("Saved!");
        console.log("IQ: Playlist saved!: ", data.response.playlistUrl);
        setTimeout(function() { window.location.href = data.response.playlistUrl; }, 1000);
      }).fail(function() {
        $("#iqy-btn-export span").html("Failed! Login?");
        console.log("IQ: Failed to save playlist. Are you logged in?");
      });
  }

  function createExportButton(controlBox) {
    var videos = loadList();

    if (videos.length === 0) return; // nothing to export

    controlBox.append($("<a>")
      .attr("id", "iqy-btn-export")
      .attr("class", "yt-uix-button yt-uix-button-default yt-uix-button-size-default")
      .append($("<img id='iqy-btnicon'>")
        .attr("src", chrome.extension.getURL("images/export.png"))
      )
      .append($("<span>").html("Save playlist"))
      .on("click", function() {
        exportVideosAsPlaylist();
      })
    );
  }

  function createControls() {
    $("#iqy-controls").html(''); // reset

    if (loadList().length === 0) return;

    var controlBox = $("#iqy-controls");

    createControlButton(controlBox);
    createNextButton(controlBox);
    createExportButton(controlBox);
  }

  function createVideoItem(video) {
    var isCurVideo = (getCurrentVideo() === video.iqid);

    var liHtml = ""+
      "<li class='__CUR_VID__' data-iqid='__IQID__'>"+
        "<a class='iqy-removevid yt-uix-button yt-uix-button-default yt-uix-button-size-default'>X</a>"+
        "<img class='iqy-list-image' src='__IMG_SRC__' />"+
        "<div class='iqy-list-info'>"+
          "<a href='//www.youtube.com/watch?v=__ID__'>"+
            "<h4 class='iqy-list-title'>__TITLE__</h4>"+
          "</a>"+
          "<p>"+
            "by __USER__ <br>"+
            "__VIEWS__ views"+
          "</p>"+
        "</div>"+
      "</li>";

    var listItem = $(liHtml
      .replace("__IQID__", video.iqid)
      .replace("__CUR_VID__", isCurVideo ? "iqy-current-video" : "")
      .replace("__ID__", video.data.id)
      .replace("__IMG_SRC__", video.data.image)
      .replace("__TITLE__", video.data.title.replace(/(.{56}).+/,"$1...")) // trim long titles
      .replace("__USER__", video.data.user)
      .replace("__VIEWS__", video.data.views)
    );

    listItem.find(".iqy-removevid").on("click", function() {
      console.log("IQ: Removing: ", video.iqid, "TITLE: ", video.data.title);
      removeVideoFromList(video);
    });

    return listItem;
  }

  function populateVideoList() {
    var list = $("<ul>").attr("id", "iqy-video-list");
    var videoList = loadList();

    if (videoList.length === 0) {
      $("#iqy-placeholder").show();
    } else {
      $("#iqy-placeholder").hide();
    }

    _.each(videoList, function(video) {
      list.append(createVideoItem(video));
    });

    $("#iqy-video-list").remove(); // remove the old list
    $("#iqy-videos").append(list);

    new Sortable($("#iqy-video-list")[0], {
        // Changed sorting within list
        onUpdate: function (evt) {
          saveListOrder();
        },
    });
  }

  function loadList() {
    return JSON.parse(sessionStorage.getItem(LIST_STORAGE) || "[]");
  }

  function saveList(list) {
    sessionStorage.setItem(LIST_STORAGE, JSON.stringify(list));
  }

  function saveListOrder() {
    var newOrder = {};
    $("#iqy-video-list").children().each(function(i) {
      newOrder[$(this).attr("data-iqid")] = i;
    });
    saveList(_.sortBy(loadList(), function(item) {
      return newOrder[item.iqid];
    }));
    createControls();
    populateVideoList();
  }

  function showDrawer() {
    // console.log("IQ: showing drawer");
    $("#iqy-main").addClass("show");
  }

  function hideDrawer() {
    // console.log("IQ: hiding drawer");
    $("#iqy-main").removeClass("show");
  }

  function getMainpageVideoData(videoNode) {
    var $videoNode = $(videoNode);
    var id = $videoNode.attr("data-context-item-id");
    var image = $videoNode.find(".yt-thumb img").attr("src");
    var title = $videoNode.find(".yt-lockup-title a").text();
    var user = $videoNode.find(".yt-lockup-byline a").text();
    var views = $videoNode.find(".yt-lockup-meta-info li").text().replace(/\D/g,"");

    return {
      id: id,
      image: image,
      title: title,
      user: user,
      views: views
    };
  }

  function getSidebarVideoData(videoNode) {
    var $videoNode = $(videoNode);
    var id = $videoNode.find(".yt-uix-simple-thumb-related").attr("data-vid");
    var image = $videoNode.find(".yt-uix-simple-thumb-related img").attr("src");
    var title = $videoNode.find(".title").text();
    var user = $videoNode.find(".attribution").text().replace(/\s*by\s+/, "");
    var views = $videoNode.find(".view-count").text().replace(/\D/g,"");

    image = image.replace("/default.", "/mqdefault."); // get higher quality version

    return {
      id: id,
      image: image,
      title: title,
      user: user,
      views: views
    };
  }

  function findVideoData(event, elem) {
    // console.log(elem);

    var videoNode = null;
    var videoData = null;

    if ((videoNode = $(elem).closest("li.related-list-item")).length > 0)
      videoData = getSidebarVideoData(videoNode[0]);
    else if ((videoNode = $(elem).parents("div.yt-lockup-video")).length > 0)
      videoData = getMainpageVideoData(videoNode[0]);

    // console.log("IQ: Video data: ", videoData);

    return videoData;
  }

  function removeVideoFromList(video) {
    var list = loadList();
    var vidIndex = _.indexOf(_.pluck(list, "iqid"), video.iqid);
    var currVid = getCurrentVideo();
    if (currVid === video.iqid) {
      if (vidIndex === 0) setCurrentVideo("");
      else setCurrentVideo(list[vidIndex - 1].iqid);
    }
    saveList(_.reject(list, function(item) { return item.iqid === video.iqid; }));
    createControls();
    populateVideoList();
  }

  function addVideoToList(videoData) {
    var list = loadList();
    list.push({iqid: randId(), data: videoData});
    saveList(list);
    createControls();
    populateVideoList();
  }

  function setupDraggableVideos() {
    function setupDraggableLinks() {
      // console.log("IQ: Setting up links!");
      $("a").each(function() {
        if ($(this).attr('draggable') === 'true' || $(this).parents("#iqy-main").length > 0) return;

        $(this).attr('draggable', 'true').on("dragstart", function (e) {
          // console.log("IQ: dragging video");
          showDrawer();
          e.originalEvent.dataTransfer.setData('youtube-video', JSON.stringify(findVideoData(e, this)));
        });
      });
    }
    setupDraggableLinks();

    setInterval(setupDraggableLinks, 500);
  }

  function setupDragTarget() {
    $('#iqy-main').on('dragover', function (e) {
      if (e.originalEvent.preventDefault) e.originalEvent.preventDefault(); // allows us to drop
      e.originalEvent.dataTransfer.dropEffect = 'link';
      return false;
    }).on('dragenter', function (e) {
      return false;
    }).on('dragleave', function () {

    }).on('drop', function (e) {
      if (e.originalEvent.stopPropagation) e.originalEvent.stopPropagation(); // stops the browser from redirecting

      var videoData = JSON.parse(e.originalEvent.dataTransfer.getData('youtube-video') || "");

      if (videoData) {
        addVideoToList(videoData);
      }

      return false;
    });
  }

  createMainSkeleton();
  setupDraggableVideos();
  setupDragTarget();
  createControls();
  populateVideoList();
  checkVideoStatus();

  console.log("IQ: Instant Queue for Youtube, ready!");
});
