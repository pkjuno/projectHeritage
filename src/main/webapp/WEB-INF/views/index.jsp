<%--
  Created by IntelliJ IDEA.
  User: pkjun
  Date: 2024-08-20
  Time: 오후 6:17
  To change this template use File | Settings | File Templates.
--%>
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>
<c:set var="cp" value="${pageContext.request.contextPath}"/>
<html>
<head>
    <title>Title</title>
    <%-- 공통 스타일 --%>
    <%@ include file="/WEB-INF/views/comm/styles.jsp" %>
    <%-- 공통 스크립트 --%>
    <%@ include file="/WEB-INF/views/comm/scripts.jsp" %>
</head>
<body>
    <h1> hi Index </h1>
    <button class="btn btn-check">예약하기</button>
</body>
</html>
